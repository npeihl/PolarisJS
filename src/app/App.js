define([
  'dojo/aspect',
  'dojo/dom',
  'dojo/dom-construct',
  'dojo/on',
  'dojo/keys',
  'dojo/parser',
  'dojo/ready',
  'dojo/_base/array',
  'dojo/_base/Color',
  'dojo/_base/declare',
  'dojo/_base/event',
  'dojo/_base/lang',
  'dojo/store/Memory',
  'dgrid/OnDemandGrid',
  'dgrid/Selection',
  'esri/map',
  'esri/arcgis/utils',
  'esri/config',
  'esri/dijit/Legend',
  'esri/dijit/Measurement',
  'esri/dijit/OverviewMap',
  'esri/dijit/Scalebar',
  'esri/graphic',
  'esri/graphicsUtils',
  'esri/units',
  'esri/layers/ArcGISDynamicMapServiceLayer',
  'esri/layers/GraphicsLayer',
  'esri/symbols/PictureMarkerSymbol',
  'esri/symbols/SimpleLineSymbol',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleFillSymbol',
  'esri/tasks/FindTask',
  'esri/tasks/FindParameters',
  'esri/tasks/GeometryService',
  'esri/toolbars/navigation',
  'esri/urlUtils',
  'dijit/layout/ContentPane',
  'dijit/layout/BorderContainer',
  'dijit/layout/AccordionContainer',
  'dijit/Dialog',
  'dijit/form/Form',
  'dijit/form/Button',
  'dijit/registry',
  'dijit/Toolbar',
  'agsjs/dijit/TOC',
  'cmv/dijit/Print',
  'cmv/dijit/Draw',
  'dojo/domReady!'
], function (
  aspect,
  dom,
  domConstruct,
  on,
  keys,
  parser,
  ready,
  array,
  Color,
  declare,
  event,
  lang,
  Memory,
  Grid,
  Selection,
  Map,
  arcgisUtils,
  config,
  Legend,
  Measurement,
  OverviewMap,
  Scalebar,
  Graphic,
  graphicsUtils,
  Units,
  ArcGISDynamicMapServiceLayer,
  GraphicsLayer,
  PictureMarkerSymbol,
  SimpleLineSymbol,
  SimpleMarkerSymbol,
  SimpleFillSymbol,
  FindTask,
  FindParameters,
  GeometryService,
  Navigation,
  urlUtils,
  ContentPane,
  BorderContainer,
  AccordionContainer,
  Dialog,
  Form,
  Button,
  registry,
  Toolbar,
  TOC,
  Print,
  Draw

) {

  var map, initialExtent, navToolbar
  var findTask, findParams, grid, measurement
  var findGraphicsLayer
  var selectedGraphicsLayer
  var zoomSymbol, draw, print
  var response, popupHandler
  var store

  return {
    startup: function () {
      parser.parse()
      config.defaults.geometryService = new GeometryService('https://www.sjcgis.org/arcgis/rest/services/Utilities/Geometry/GeometryServer')
      config.defaults.io.proxyUrl = '/proxy/proxy.ashx'

      grid = new (declare([Grid, Selection]))({
        selectionMode: 'extended',
        noDataMessage: 'No Results Found',
        loadingMessage: 'Searching...',
        columns: {
          'foundFieldName': 'Type',
          'value': 'Value'
        }
      }, 'grid')

      grid.on('dgrid-select', lang.hitch(this, 'rowSelectHandler'))
      grid.on('dgrid-deselect', lang.hitch(this, 'rowDeselectHandler'))
      on(dom.byId('searchText'), 'keydown', lang.hitch(this, function (e) {
        if (e.keyCode == keys.ENTER) {
          this.doSearch(dom.byId('searchText').value)
          event.stop(e)
        }
      }))

      var mapDeferred = arcgisUtils.createMap('cf47d72e5f0e4f02aa8b35a2e9b6ac98', 'map', {
        geometryServiceURL: 'https://www.sjcgis.org/arcgis/rest/services/Utilities/Geometry/GeometryServer'
      })

      mapDeferred.then(lang.hitch(this, function (appResponse) {
        response = appResponse
        map = response.map
        /* We disable panning so that the pan tool must be used instead.
         This eliminates confusion when the identify tool is active */
        map.disablePan()

        /* Let's create a Finder for locating features in the map layers */
        this.constructFindTask()

        /* Do we have a URL parameter to search for? If so, send it to the findTask */
        var params = urlUtils.urlToObject(document.location.href)
        if (params.query && params.query.find) {
          console.log('URL Query Find found')
          dom.byId('searchText').value=params.query.find
          this.doSearch(params.query.find)
        }

        /* When the basemap has loaded, let's add scalebar and overview map */
        map.on('load', this.constructMapElements())


        /* After all map layers have been added, let's create the navigation toolbar and side panels */
        map.on('layers-add-result', this.constructNavToolbar())
        map.on('layers-add-result', this.constructSidePanels(response))

        /* We need to disable popups until the identify button is toggled on */
        popupHandler = response.clickEventHandle
        popupHandler.remove()
        leftAccordion.watch('selectedChildWidget', lang.hitch(this, 'accordionHandler'))

        /* Bug workaround where measure location tool is deactivated after a point is measured.
         We want the tool to remain active until the panel is closed.
         measurement.on('measure-end', function(evt){
         measurement.setTool(evt.toolName, true)
         }) */

      }))
    },

    constructSidePanels: function (response) {
      this.constructLegend(response)
      this.constructToc(response)
      this.constructMeasure(response)
      this.constructPrint()
      this.constructDraw()
      this.constructDisclaimer(response)
    },

    navigationChangeHandler: function (div) {
      var tool
      this.clearToggleButtons(div)
      switch (div) {
      case 'zoomIn':
        navToolbar.activate(Navigation.ZOOM_IN)
        break
      case 'zoomOut':
        navToolbar.activate(Navigation.ZOOM_OUT)
        break
      case 'pan':
        navToolbar.activate(Navigation.PAN)
        break
      case 'identify':
        navToolbar.deactivate()
        this.enablePopups()
        break
      default:
        navToolbar.deactivate()
        break
      }
    },


    constructNavToolbar: function () {
      zoomSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,new                                                           SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color('black'), 2),
                                        new Color([255,255,255,0.5]))
      navToolbar = new Navigation(map)
      navToolbar.setZoomSymbol(zoomSymbol)
      navToolbar.on('extent-history-change', this.extentHistoryChangeHandler)
      registry.byId('zoomIn').onClick = lang.hitch(this, 'navigationChangeHandler', 'zoomIn')
      registry.byId('zoomOut').onClick = lang.hitch(this, 'navigationChangeHandler', 'zoomOut')
      registry.byId('pan').onClick = lang.hitch(this, 'navigationChangeHandler', 'pan')
      registry.byId('identify').onClick = lang.hitch(this, 'navigationChangeHandler', 'identify')
      registry.byId('prevExtent').onClick = function () { navToolbar.zoomToPrevExtent() }
      registry.byId('nextExtent').onClick = function () { navToolbar.zoomToNextExtent() }
      registry.byId('fullExtent').onClick = function () { navToolbar.zoomToFullExtent() }
      aboutDialog = new Dialog({
        title: 'About',
        content: response.itemInfo.item.description,
        style: 'width: 50%'
      })
    },

    constructLegend: function (response) {
      var layerInfo = arcgisUtils.getLegendLayers(response)
      var legend = new Legend({
        map:map,
        layerInfos: layerInfo
      },'legendDiv')
      legend.startup()
    },

    constructToc: function (response) {
      var layerInfo = arcgisUtils.getLegendLayers(response)
      array.map(layerInfo, function(layer){
        layer.collapsed=true
      })
      layerInfo.reverse()
      var toc = new TOC({
        map:map,
        layerInfos: layerInfo
      }, 'tocDiv')
      toc.startup()
    },

    constructPrint: function () {
      print = new Print({
        map: map,
        printTaskURL: 'https://www.sjcgis.org/arcgis/rest/services/Tools/ExportWebMap/GPServer/Export%20Web%20Map',
        authorText: 'Printed from Polaris Property Search - San Juan County WA',
        copyrightText: 'This data has been compiled for San Juan County. Various official and unofficial sources were used to gather this information. Every effort was made to ensure the accuracy of this data, however, no guarantee is given or implied as to the accuracy of said data.',
        defaultTitle: 'My Map',
        defaultFormat: 'PDF',
        defaultLayout: 'Letter_Landscape'
      }, domConstruct.create('div'))
      print.placeAt('printPane')
    },

    constructDraw: function () {
      /* TODO: Replace with Template Picker
       & use items rather than Feature Layers */
      draw = new Draw({
        map: map
      }, domConstruct.create('div'))
      draw.placeAt('drawPane')
      aspect.after(draw.drawToolbar, 'activate', this.navigationChangeHandler())
    },

    constructMeasure: function (response) {
      measurement = new Measurement({
        map: map,
        defaultAreaUnit: Units.ACRES,
        defaultLengthUnit: Units.FEET,
      }, dom.byId('measureDiv'))
      measurement.startup()
      measurement.on('tool-change', lang.hitch(this, 'navigationChangeHandler'))
    },

    constructDisclaimer: function (response) {
      var disclaimerText = domConstruct.toDom(response.itemInfo.item.licenseInfo)
      domConstruct.place(disclaimerText, 'disclaimerPane')
    },

    constructMapElements: function () {
      var scaleBar = new Scalebar({
        map: map,
        scalebarUnit: 'english'
      })
      var ovMapBaseLayer = new ArcGISDynamicMapServiceLayer('https://www.sjcgis.org/arcgis/rest/services/Polaris/Shorelines/MapServer')
      var overviewMap = new OverviewMap({
        map: map,
        height: 200,
        width: 200,
        baseLayer: ovMapBaseLayer,
      }, dom.byId('overviewMapDiv'))
      overviewMap.startup()
    },

    constructFindTask: function () {
      findGraphicsLayer = new GraphicsLayer({
        spatialReference:  map.spatialReference
      })
      selectedGraphicsLayer = new GraphicsLayer({
        spatialReference: map.spatialReference
      })
      map.addLayers([findGraphicsLayer,selectedGraphicsLayer])
      findTask = new FindTask('https://www.sjcgis.org/arcgis/rest/services/Polaris/LocationSearch/MapServer')
      // Create find parameters
      findParams = new FindParameters()
      findParams.returnGeometry = true
      /* Enter the id number of the layers to search  */
      findParams.layerIds = [4,1,0,2,3]
      /* Enter the names of the fields to search over the layers */
      findParams.searchFields = ['FULLADDR', 'Road_Name', 'PIN', 'NAME']
      findParams.outSpatialReference = map.spatialReference
      var searchButton = new Button({
        label: 'Search',
        onClick: lang.hitch(this, function () { this.doSearch(dom.byId('searchText').value) })
      }, 'searchButton')
      var clearButton = new Button({
        label: 'Clear',
        onClick: lang.hitch(this, 'clearSearch')
      }, 'clearButton')
    },

    doSearch: function (searchText) {
      // Set search text to value in box
      findParams.searchText = searchText
      dom.byId('searchIndicator').style.visibility='visible'
      findTask.execute(findParams, this.showResults)
    },

    showResults: function (results) {
      dom.byId('searchIndicator').style.visibility='hidden'
      dom.byId('grid').style.visibility='visible'
      //Show the results of FindTask using the FindResult returned by the doFind function
      findGraphicsLayer.clear() //Clear existing graphics from map
      var polygonSymbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NULL, new
                                               SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0,255,255]), 4),
                                               new Color([0,255,255,0.25]))
      var lineSymbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID,
                                            new Color([98,194,204]),2)
      var markerSymbol = new PictureMarkerSymbol({
        'url': 'app/images/pin-red-28x28.png',
        'height': 20,
        'width': 20,
        'type': 'picturemarkersymbol'
      })
      //Create array of result attributes and add graphics to map
      var data = dojo.map(results, function(result, id){
        var graphic = new Graphic(result.feature.toJson())
        var marker
        switch (graphic.geometry.type) {
        case 'point':
          graphic.setSymbol(markerSymbol)
          marker = new Graphic(graphic.geometry, markerSymbol)
          break
        case 'polyline':
          graphic.setSymbol(lineSymbol)
          marker = new Graphic(result.feature.geometry, lineSymbol)
          break
        case 'polygon':
          graphic.setSymbol(polygonSymbol)
          marker = new Graphic(result.feature.geometry, polygonSymbol)
          break
        }
        findGraphicsLayer.add(marker)
        var attribs = result.feature.attributes
        attribs.id = id
        attribs.foundFieldName = result.foundFieldName
        attribs.value = result.value
        attribs.layerName = result.layerName
        attribs.graphic = graphic
        attribs.marker = marker
        return attribs
      })

      store = new Memory({
        data: data
      })
      grid.setStore(store)

      /* Now we want to zoom to the found features. But when there is only
       one result from the find, the esriGraphicsExtent is null. This may be
       a bug. So we form a switch based on the number of found features and
       handle it differently if the number is 0, 1 or more than 1. */
      switch (findGraphicsLayer.graphics.length) {
      case 0:
        map.setExtent(initialExtent)
        break
      case 1:
        findGraphicsLayer.clear()
        zoomToSelectedRow(grid.getItem(0).graphic[0])
        break
      default:
        var foundFeaturesExtent = graphicsUtils.graphicsExtent(findGraphicsLayer.graphics)
        map.setExtent(foundFeaturesExtent,true)
      }
    },

    clearSearch: function () {
      findGraphicsLayer.clear()
      selectedGraphicsLayer.clear()
      dom.byId('grid').style.visibility='hidden'
      dom.byId('searchText').value = ''

      store = new Memory({data:{identifier:'', items:[]}})
      grid.setStore(store)
    },

    extentHistoryChangeHandler: function () {
      registry.byId('prevExtent').disabled = navToolbar.isFirstExtent()
      registry.byId('nextExtent').disabled = navToolbar.isLastExtent()
    },

    rowDeselectHandler: function (evt) {
      var rows = evt.rows
      array.forEach(rows, function (row) {
        selectedGraphicsLayer.remove(row.data.graphic)
      })
      var selectedFeaturesExtent = graphicsUtils.graphicsExtent(selectedGraphicsLayer.graphics) || null
      if (!selectedFeaturesExtent) {
        map.centerAndZoom(selectedGraphicsLayer.graphics[0].geometry, 8)
      } else {
        map.setExtent(selectedFeaturesExtent, true)
      }
    },

    rowSelectHandler: function (evt) {
      findGraphicsLayer.clear()
      var rows = evt.rows
      array.forEach(rows, function (row) {
        var clickedRowGraphic = row.data.graphic
        clickedRowGraphic.attr('rowID', row.id)
        //zoomToSelectedRow(clickedRowGraphic)
        selectedGraphicsLayer.add(clickedRowGraphic)
      })
      var selectedFeaturesExtent = graphicsUtils.graphicsExtent(selectedGraphicsLayer.graphics) || null
      if (!selectedFeaturesExtent) {
        map.centerAndZoom(selectedGraphicsLayer.graphics[0].geometry, 8)
      } else {
        map.setExtent(selectedFeaturesExtent, true)
      }
    },

    accordionHandler: function (attr, closedPane, openPane) {
      console.log('The closed pane was ' + closedPane.id + ' and the opened pane was ' + openPane.id)
      /* When the measure or draw panes are closed, deactivate the tools */
      this.clearToggleButtons()
      navToolbar.deactivate()
      switch(closedPane.id){
      case 'measurePane':
        measurement.clearResult()
        measurement.setTool('area', false)
        measurement.setTool('distance', false)
        measurement.setTool('location', false)
        break
      case 'drawPane':
        draw.drawToolbar.deactivate()
        break
      default:
      }
    },

    clearToggleButtons: function (button) {
      this.disablePopups()
      registry.byId('zoomIn').set('checked',false)
      registry.byId('zoomOut').set('checked', false)
      registry.byId('pan').set('checked', false)
      registry.byId('identify').set('checked', false)
      if (button) registry.byId(button).set('checked',true)
    },

    disablePopups: function () {
      if (typeof popupHandler === 'object') {
        popupHandler.remove()
      }
      console.log('Popups should be disabled')
    },

    enablePopups: function () {
      popupHandler = map.on('click', response.clickEventListener)
      console.log('Popups should be enabled')
    }
  }
})
