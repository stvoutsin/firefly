package edu.caltech.ipac.firefly.visualize.graph;

import com.google.gwt.core.client.GWT;
import com.google.gwt.core.client.Scheduler;
import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.user.client.rpc.AsyncCallback;
import com.google.gwt.user.client.ui.*;
import com.googlecode.gchart.client.GChart;
import edu.caltech.ipac.firefly.core.Application;
import edu.caltech.ipac.firefly.core.GeneralCommand;
import edu.caltech.ipac.firefly.data.Param;
import edu.caltech.ipac.firefly.data.TableServerRequest;
import edu.caltech.ipac.firefly.data.table.*;
import edu.caltech.ipac.firefly.resbundle.images.VisIconCreator;
import edu.caltech.ipac.firefly.ui.*;
import edu.caltech.ipac.firefly.ui.table.BasicTable;
import edu.caltech.ipac.firefly.ui.table.DataSetTableModel;
import edu.caltech.ipac.firefly.ui.table.FilterToggle;
import edu.caltech.ipac.firefly.ui.table.ModelEventHandler;
import edu.caltech.ipac.firefly.ui.table.filter.FilterDialog;
import edu.caltech.ipac.firefly.ui.table.filter.FilterPanel;
import edu.caltech.ipac.firefly.util.MinMax;
import edu.caltech.ipac.firefly.util.PropertyChangeEvent;
import edu.caltech.ipac.firefly.util.PropertyChangeListener;
import edu.caltech.ipac.firefly.util.WebUtil;
import edu.caltech.ipac.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * @author tatianag
 * $Id $
 */
public class XYPlotWidget extends XYPlotBasicWidget implements FilterToggle.FilterToggleSupport {

    public static final boolean ENABLE_XY_CHARTS = Application.getInstance().getProperties().getBooleanProperty("XYCharts.enableXYCharts", true);

    private static final String SELECT_HELP = "&nbsp;Click and drag an area to select points in it.&nbsp;";
    private static final String UNSELECT_HELP = "&nbsp;Click and drag an empty area to unselect points.&nbsp;";

    private FilterToggle _filters;
    private DeckPanel selectToggle;
    private Widget _filterSelectedLink;
    boolean _rubberbandZooms = true;
    private String _sourceFile = null;
    private String _suggestedName = null;
    private boolean _suspendEvents = false;

    GChart.Curve _highlightedPoints;
    GChart.Curve _selectedPoints;
    private ShowColumnsDialog showColumnsDialog;
    private FilterDialog popoutFilters;

    private Image _loading = new Image(GwtUtil.LOADING_ICON_URL);

    /*
      We have two cases: when current data in table model is null (previews) and when it is not null (view)
      In the first case _tableModel.getTotalRows() returns 0, in the second case something else
     */
    private DataSetTableModel _tableModel = null;
    private PropertyChangeListener dsPropertyChangeListener;
    private ModelEventHandler dsModelEventHandler;

    public XYPlotWidget(XYPlotMeta meta) {
        super(meta);
    }

    @Override
    protected Widget getMenuBar() {
        FlowPanel menuBar = new FlowPanel();
        GwtUtil.setStyle(menuBar, "borderBottom", "1px solid #bbbbbb");
        menuBar.setWidth("100%");

        HorizontalPanel left = new HorizontalPanel();
        left.setSpacing(10);
        GwtUtil.setStyle(left, "align", "left");

        HorizontalPanel right = new HorizontalPanel();
        right.setSpacing(10);
        GwtUtil.setStyle(right, "align", "center");
        GwtUtil.setStyle(right, "paddingRight", "20px");

        VisIconCreator ic= VisIconCreator.Creator.getInstance();
        right.add(GwtUtil.makeImageButton(new Image(ic.getSave()), "Download data in IPAC table format", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                Frame f = Application.getInstance().getNullFrame();
                String url;
                if (_sourceFile.contains("://")) {
                    url = _sourceFile;
                } else {
                    Param[] params;
                    if (_suggestedName != null) {
                        params = new Param[3];
                        params[2] = new Param("return", _suggestedName);
                    } else {
                        params = new Param[2];
                    }
                    params[0] = new Param("file", _sourceFile);
                    params[1] = new Param("log", "true");
                    url = WebUtil.encodeUrl(GWT.getModuleBaseURL() + "servlet/Download", params);
                }
                f.setUrl(url);
            }
        }));

        right.add(GwtUtil.makeImageButton(new Image(ic.getZoomOriginal()), "Zoom out to original chart", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                if (_data != null) {
                    _savedSelection = null;
                    setChartAxes();
                    _actionHelp.setHTML(_rubberbandZooms ?ZOOM_IN_HELP:SELECT_HELP);
                    _chart.update();
                }
            }
        }));

        selectToggle = new DeckPanel();
        selectToggle.add(GwtUtil.makeImageButton(new Image(ic.getSelectAreaOff()), "Select enclosed points on rubberband", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                if (_data != null) {
                    _rubberbandZooms = false;
                    _actionHelp.setHTML(SELECT_HELP);
                    selectToggle.showWidget(1);
                }
            }
        }));
        selectToggle.add(GwtUtil.makeImageButton(new Image(ic.getSelectAreaOn()), "Turn off selection mode", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                if (_data != null) {
                    _rubberbandZooms = true;
                    _actionHelp.setHTML(ZOOM_IN_HELP);
                    selectToggle.showWidget(0);
                }
            }
        }));
        selectToggle.showWidget(0);
        right.add(selectToggle);

        _filterSelectedLink = GwtUtil.makeImageButton(new Image(ic.getFilterSelected()), "Filter in the selected points", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                filterSelected();
            }
        });
        _filterSelectedLink.setVisible(false);
        right.add(_filterSelectedLink);

        right.add(GwtUtil.makeImageButton(new Image(ic.getFitsHeader()), "Show All Columns", new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                showColumns(RootPanel.get(), PopupPane.Align.CENTER);
            }
        }));



        Label text = new Label("Options");
        HorizontalPanel hp = new HorizontalPanel();
        hp.setSpacing(2);
        hp.add(new Image(ic.getSettings()));
        hp.add(text);
        GwtUtil.makeIntoLinkButton(hp);
        text.addClickHandler(new ClickHandler() {
            public void onClick(ClickEvent event) {
                showOptions();
            }
        });
        left.add(hp);

        _filters = new FilterToggle(this);
        left.add(_filters);

        left.add(_loading);
        _loading.setVisible(false);

        menuBar.add(GwtUtil.leftRightAlign(new Widget[]{left}, new Widget[]{right}));

        return menuBar;
    }


    public void makeNewChart(final DataSetTableModel tableModel, String title) {
        if (!tableModel.equals(_tableModel)) {
            if (_tableModel != null && dsModelEventHandler != null) {
                _tableModel.removeHandler(dsModelEventHandler);
                DataSet ds = _tableModel.getCurrentData();
                if (ds != null && dsPropertyChangeListener != null) {
                    ds.removePropertyChangeListener(dsPropertyChangeListener);
                }
            }
            _tableModel = tableModel;
            dsModelEventHandler = new ModelEventHandler(){

                public void onFailure(Throwable caught) {
                }

                public void onLoad(TableDataView result) {
                    updateStatusMessage();
                }

                public void onStatusUpdated(TableDataView result) {
                    updateStatusMessage();
                }

                public void onDataStale(DataSetTableModel model) {
                    doServerCall(getRequiredCols(), _meta.getMaxPoints());
                }
            };
            _tableModel.addHandler(dsModelEventHandler);

            DataSet ds = _tableModel.getCurrentData();
            if (ds != null) {
                dsPropertyChangeListener = new PropertyChangeListener() {
                    public void propertyChange(PropertyChangeEvent pce) {
                        if (_data != null && !_suspendEvents) {
                            if (pce.getPropertyName().equals(TableDataView.ROW_HIGHLIGHTED)) {
                                setHighlighted((Integer)pce.getNewValue());
                            } else if (pce.getPropertyName().equals(TableDataView.ROW_SELECT_ALL) ||
                                    pce.getPropertyName().equals(TableDataView.ROW_DESELECT_ALL)) {
                                setSelected((SelectionInfo)pce.getNewValue());
                            } else if (pce.getPropertyName().equals(TableDataView.ROW_SELECTED) ||
                                    pce.getPropertyName().equals(TableDataView.ROW_DESELECTED)) {
                                setSelected((SelectionInfo)pce.getOldValue());
                            }
                        }
                    }
                };
                ds.addPropertyChangeListener(dsPropertyChangeListener);
            }
            _suspendEvents = false;
        }
        _maskPane.hide();
        setupNewChart(title);
        doServerCall(getRequiredCols(), _meta.getMaxPoints());
    }

    private void doServerCall(final List<String> requiredCols, final int maxPoints) {
        _loading.setVisible(true);
        _maskPane.hide();
        _filters.reinit();
        _dataSet = null;
        _savedSelection = null; // do not preserve zoomed selection

        removeCurrentChart();
        GwtUtil.DockLayout.hideWidget(_dockPanel, _statusMessage);
        if (showColumnsDialog != null) { showColumnsDialog.setVisible(false); showColumnsDialog = null; }

        ServerTask task = new ServerTask<TableDataView>(_dockPanel, "Retrieving Data...", true) {
            public void onSuccess(TableDataView result) {
                try {
                    _dataSet = (DataSet)result;
                    //_dataSet = result.subset(0, tableDataView.getTotalRows());
                    addData(_dataSet, _tableModel.getRequest());
                    updateStatusMessage();
                    onResize();
                    //resize(_dockPanel.getOffsetWidth(), _dockPanel.getOffsetHeight());
                } catch (Exception e) {
                    showMask(e.getMessage());
                } finally {
                    _loading.setVisible(false);
                }
            }

            @Override
            public void onFailure(Throwable throwable) {
                _loading.setVisible(false);
                showMask(throwable.getMessage());
            }


            @Override
            public void doTask(AsyncCallback<TableDataView> passAlong) {
                _tableModel.getAdHocData(passAlong, requiredCols, 0, maxPoints);
            }
        };
        //task.setMaskingDelaySec(1);
        task.start();
    }

    private List<String> getRequiredCols() {
        final ArrayList<String> requiredCols = new ArrayList<String>();

        // Limit number of columns for bigger tables
        if (_tableModel.getTotalRows() > 10) {
            ArrayList<String> cols = new ArrayList<String>();
            List<TableDataView.Column> allCols = _tableModel.getCurrentData().getColumns();
            for (TableDataView.Column c : allCols) {
                // interested only in numeric columns
                if (!c.getType().startsWith("c")) {
                    cols.add(c.getName());
                }
            }
            XYPlotMeta.UserMeta userMeta = _meta.userMeta;
            String c;
            if (userMeta != null && userMeta.xColExpr != null) {
                Set<String> cSet = userMeta.xColExpr.getParsedVariables();
                for (String s : cSet) {
                    if (!StringUtils.isEmpty(s)) requiredCols.add(s);
                }
            } else {
                c = _meta.findXColName(cols);
                if (!StringUtils.isEmpty(c)) requiredCols.add(c);
            }
            if (userMeta != null && userMeta.yColExpr != null) {
                Set<String> cSet = userMeta.yColExpr.getParsedVariables();
                for (String s : cSet) {
                    if (!StringUtils.isEmpty(s) && !requiredCols.contains(s)) requiredCols.add(s);
                }
            } else {
                c = _meta.findYColName(cols);
                if (!StringUtils.isEmpty(c) && !requiredCols.contains(c)) requiredCols.add(c);
            }
            c = _meta.findErrorColName(cols);
            if (!StringUtils.isEmpty(c) && !requiredCols.contains(c)) requiredCols.add(c);
            c = _meta.findDefaultOrderColName(cols);
            if (!StringUtils.isEmpty(c) && !requiredCols.contains(c)) requiredCols.add(c);
        }
        return requiredCols;
    }

    private void addData(DataSet dataSet, TableServerRequest sreq) {
        // check if DOWNLOAD_SOURCE attribute present:
        String downloadSource;
        TableMeta tableMeta = dataSet.getMeta();
        if (!StringUtils.isEmpty(tableMeta))  {
            downloadSource = dataSet.getMeta().getAttribute("DOWNLOAD_SOURCE");

            if (StringUtils.isEmpty(downloadSource)) {
                // use TableServerRequest, if available, to get source table url
                if (sreq != null) {
                    _sourceFile = WebUtil.getTableSourceUrl(sreq);
                } else {
                    _sourceFile = dataSet.getMeta().getSource();
                }
            } else {
                _sourceFile = downloadSource;
            }
        }

        try {
            addData(_dataSet);
            _selectionCurve = getSelectionCurve();
            _panel.setWidget(_cpanel);
            if (optionsDialog != null && (optionsDialog.isVisible() || _meta.hasUserMeta())) {
                if (optionsDialog.setupError()) {
                    if (!optionsDialog.isVisible()) showOptionsDialog();
                }
            }
        } catch (Throwable e) {
            if (e.getMessage().indexOf("column is not found") > 0) {
                _chart.clearCurves();
                _panel.setWidget(_cpanel);
                showOptionsDialog();
            } else {
                showMask(e.getMessage());
            }
        }

    }

    private void updateStatusMessage() {
        Scheduler.get().scheduleDeferred(new Scheduler.ScheduledCommand() {
            public void execute() {
                _statusMessage.setHTML("&nbsp;&nbsp;" + getTableInfo());
            }
        });
    }

    @Override
    public void removeCurrentChart() {
        if (_chart != null) {
            if (_highlightedPoints != null) {
                _highlightedPoints.clearPoints();
                _highlightedPoints.setCurveData(null);
            }
            if (_selectedPoints != null) {
                _selectedPoints.clearPoints();
                _selectedPoints.setCurveData(null);
            }

            super.removeCurrentChart();

            _rubberbandZooms = true;
            _filterSelectedLink.setVisible(false);
            selectToggle.showWidget(0);
        }
    }

    @Override
    protected void addMouseListeners() {

        super.addMouseListeners();

        _chart.addClickHandler(new ClickHandler() {
            public void onClick(ClickEvent clickEvent) {
                if (_chart != null && _data != null) {
                    GChart.Curve.Point touchedPoint = _chart.getTouchedPoint();
                    if (touchedPoint != null) {
                        clickEvent.preventDefault();
                        setHighlighted(_chart.getTouchedPoint());
                    }
                }
            }
        });
    }

    @Override
    protected void onSelection(MinMax xMinMax, MinMax yMinMax) {
        if (_rubberbandZooms) {
            setChartAxesForSelection(xMinMax, yMinMax);
            _chart.update();
        } else {
            setSelected(xMinMax, yMinMax);
        }
    }

    @Override
    public void updateMeta(final XYPlotMeta meta, final boolean preserveZoomSelection) {
        _loading.setVisible(true);
        Scheduler.get().scheduleDeferred(new Scheduler.ScheduledCommand() {
            public void execute() {
                try {
                    _meta = meta;
                    if (_chart != null) {
                        _chart.clearCurves();
                    }
                    if (_dataSet != null) {
                        List<String> requiredCols = null;
                        //do we need server call to get a new dataset?
                        boolean serverCallNeeded = _dataSet.getSize() < _tableModel.getTotalRows() && _meta.getMaxPoints() > _dataSet.getSize();
                        if (!serverCallNeeded) {
                            requiredCols = getRequiredCols();
                            for (String c : requiredCols) {
                                if (_dataSet.findColumn(c) == null) {
                                    serverCallNeeded = true;
                                    break;
                                }
                            }
                        }

                        if (serverCallNeeded) {
                            if (requiredCols == null) {
                                requiredCols = getRequiredCols();
                            }
                            doServerCall(requiredCols, _meta.getMaxPoints());
                        } else {
                            addData(_dataSet);
                            _selectionCurve = getSelectionCurve();
                            if (_savedSelection != null && preserveZoomSelection) {
                                setChartAxesForSelection(_savedSelection.xMinMax, _savedSelection.yMinMax);
                                _chart.update();
                            } else {
                                _savedSelection = null;
                            }
                            _loading.setVisible(false);
                        }
                    }
                    //_meta.addUserColumnsToDefault();
                } catch (Throwable e) {
                    _loading.setVisible(false);
                    if (_chart != null) {
                        _chart.clearCurves();
                    }
                    PopupUtil.showError("Error", e.getMessage());
                }
            }
        });
    }

    @Override
    protected void setDefaultActionHelp() {
        _actionHelp.setHTML(_rubberbandZooms ?ZOOM_IN_HELP:SELECT_HELP);
    }


    private void addData(DataSet dataSet) {
        super.addData(new XYPlotData(dataSet, _meta));

        // sync highlighted and selected with current dataset, if available
        if (_tableModel.getCurrentData() != null) {
            DataSet ds = _tableModel.getCurrentData();
            // set selected first, highlighted second - to show highlighted on top of selected
            setSelected(ds.getSelectionInfo());
            setHighlighted(ds.getHighlighted());
        }
    }

    @Override
    public List<TableDataView.Column> getColumns() {

        if (_tableModel != null) {
            try {
                if (_tableModel.getTotalRows()>0) {
                    return _tableModel.getCurrentData().getColumns();
                } else if (_dataSet != null) {
                    return _dataSet.getColumns();
                } else {
                    return new ArrayList<TableDataView.Column>(0);
                }
            } catch (Exception e) {
                return new ArrayList<TableDataView.Column>(0);
            }
        }
        return new ArrayList<TableDataView.Column>(0);
    }

    public String getTableInfo() {
        if (_tableModel != null) {
            try {
                boolean filtered = _tableModel.getFilters().size()>0;
               if (_tableModel.getTotalRows() > 0) {
                    boolean tableNotLoaded = !_tableModel.getCurrentData().getMeta().isLoaded();
                    int totalRows = _tableModel.getTotalRows();
                    boolean allPlotted = (totalRows <= _meta.getMaxPoints());
                    return "Data table contains "+_tableModel.getTotalRows()
                            +(tableNotLoaded ? "+" : "")
                            +(filtered ? " filtered":"")+" rows, "+
                            (allPlotted ? "all" : _meta.getMaxPoints()+"")+" plotted."+
                            (allPlotted ? "" : " Set max plotted points in options.");
                } else if (_dataSet != null) {
                    boolean tableNotLoaded = !_dataSet.getMeta().isLoaded();
                    return "Data table contains "+_dataSet.getTotalRows()
                            +(tableNotLoaded ? "+" : "")
                            +(filtered ? " filtered":"")+" rows";
                }
            } catch (Exception e) {
                return "";
            }
        }
        return "";
    }


    public void showColumns(Widget alignTo, PopupPane.Align alignAt) {
        if (_dataSet != null) {
            if (showColumnsDialog == null) {
                showColumnsDialog = new ShowColumnsDialog(alignTo, getColumns());
            }
            showColumnsDialog.alignTo(alignTo, alignAt);
            showColumnsDialog.setVisible(true);
        }
    }


    @Override
    protected XYPlotData.Point getDataPoint(GChart.Curve.Point p) {
        if (_data!=null && _mainCurves.size()>0) {
            int curveIdx = p.getParent().getParent().getCurveIndex(p.getParent());
            int pointIdx = p.getParent().getPointIndex(p);

            if (isMainCurve(curveIdx)) {
                return _data.getPoint(curveIdx, pointIdx);
            } else if (_highlightedPoints != null && curveIdx == _chart.getCurveIndex(_highlightedPoints)) {
                return (XYPlotData.Point)_highlightedPoints.getCurveData();
            } else if (_selectedPoints != null && curveIdx == _chart.getCurveIndex(_selectedPoints)) {
                List<XYPlotData.Point> dataPoints = ((SelectedData)_selectedPoints.getCurveData()).getDataPoints();
                return dataPoints.get(pointIdx);
            }
        }
        return null;
    }

    private void setHighlighted(int rowIdx) {
        if (rowIdx < 0) return;
        int curveIdx = 0;
        for (XYPlotData.Curve curve : _data.getCurveData()) {
            for (XYPlotData.Point pt : curve.getPoints()) {
                if (pt.getRowIdx() == rowIdx) {
                    setHighlighted(pt, _mainCurves.get(curveIdx), false);
                    return;
                }
            }
            curveIdx++;
        }
    }


    private void setHighlighted(GChart.Curve.Point p) {
        if (p == null) return;
        setHighlighted(getDataPoint(p), p.getParent(), true);

    }

    private void setHighlighted(XYPlotData.Point point, GChart.Curve parentCurve, boolean updateModel) {
        if (point == null) return;

        boolean doHighlight = true; // we want to unhighlight when clicking on a highlighted point
        if (_highlightedPoints == null || _chart.getCurveIndex(_highlightedPoints)<0) {
            _chart.addCurve();
            _highlightedPoints = _chart.getCurve();
            GChart.Symbol symbol= _highlightedPoints.getSymbol();
            symbol.setBorderColor("black");
            symbol.setBackgroundColor("yellow");
            symbol.setSymbolType(GChart.SymbolType.BOX_CENTER);
            symbol.setHoverSelectionEnabled(true);
            symbol.setHoverAnnotationEnabled(true);

            GChart.Symbol refSym = parentCurve.getSymbol();
            symbol.setBrushHeight(refSym.getBrushHeight());
            symbol.setBrushWidth(refSym.getBrushWidth());
            symbol.setHoverSelectionWidth(refSym.getHoverSelectionWidth());
            symbol.setHoverSelectionHeight(refSym.getHoverSelectionHeight());
            symbol.setHoverSelectionBackgroundColor(symbol.getBackgroundColor());
            symbol.setHoverSelectionBorderColor(refSym.getBorderColor());
            symbol.setHoverAnnotationSymbolType(refSym.getHoverAnnotationSymbolType());
            symbol.setHoverLocation(refSym.getHoverLocation());
            symbol.setHoverYShift(refSym.getHoverYShift());
            symbol.setHovertextTemplate(refSym.getHovertextTemplate());
        } else {
            if (_highlightedPoints.getNPoints() > 0) {
                if (updateModel) {
                    GChart.Curve.Point currentHighlighted = _highlightedPoints.getPoint();
                    //XYPlotData.Point currentPoint = (XYPlotData.Point)_highlightedPoints.getCurveData();
                    if (point.getX() == _xScale.getScaled(currentHighlighted.getX()) &&
                            point.getY() == _yScale.getScaled(currentHighlighted.getY())) {
                        doHighlight = false;  // unhighlight if a highlighted point is clicked again
                    }
                }
                // unhighlight
                _highlightedPoints.clearPoints();
                _highlightedPoints.setCurveData(null);
            }
        }

        // highlight
        if (doHighlight) {
            _highlightedPoints.setCurveData(point);
            _highlightedPoints.addPoint(_xScale.getScaled(point.getX()), _yScale.getScaled(point.getY()));
            //_highlightedPoints.getSymbol().setHovertextTemplate(p.getHovertext());
            if (updateModel && _tableModel.getCurrentData()!=null) {
                _suspendEvents = true;
                _tableModel.getCurrentData().highlight(point.getRowIdx());
                _suspendEvents = false;
            }
        }
        _chart.update();
    }

    public void setSelected(SelectionInfo selectionInfo) {
        if (selectionInfo == null) {
            return;
        }
        if (selectionInfo.isSelectAll())  {
            List<XYPlotData.Point> dataPoints = new ArrayList<XYPlotData.Point>();
            for (XYPlotData.Curve curve : _data.getCurveData()) {
                dataPoints.addAll(curve.getPoints());
            }
            setSelected(new SelectedData(null, null, dataPoints), false);
        } else {
            if (selectionInfo.getSelected().size() == 0) {
                List<XYPlotData.Point> emptyList = new ArrayList<XYPlotData.Point>();
                setSelected(new SelectedData(null, null, emptyList), false);
            } else {
                List<XYPlotData.Point> dataPoints = new ArrayList<XYPlotData.Point>();
                for (XYPlotData.Curve curve : _data.getCurveData()) {
                    for (XYPlotData.Point pt : curve.getPoints()) {
                        if (selectionInfo.isSelected(pt.getRowIdx())) {
                            dataPoints.add(pt);
                        }
                    }
                }
                setSelected(new SelectedData(null, null, dataPoints), false);
            }
        }
    }

    private void setSelected(MinMax xMinMax, MinMax yMinMax) {

        double xMin = xMinMax.getMin();
        double xMax = xMinMax.getMax();
        double yMin = yMinMax.getMin();
        double yMax = yMinMax.getMax();

        double x,y;
        List<XYPlotData.Point> dataPoints = new ArrayList<XYPlotData.Point>();
        for (XYPlotData.Curve c : _data.getCurveData()) {
            for (XYPlotData.Point p : c.getPoints()) {
                x = p.getX();
                y = p.getY();
                if (x > xMin && x < xMax && y > yMin && y < yMax) {
                    dataPoints.add(p);
                }
            }
        }
        setSelected(new SelectedData(xMinMax, yMinMax, dataPoints), true);
    }

    private void setSelected(SelectedData selectedData, boolean updateModel) {

        if (_mainCurves.size() < 1) return;
        if (_selectedPoints == null || _chart.getCurveIndex(_selectedPoints)<0) {
            _chart.addCurve();
            _selectedPoints = _chart.getCurve();
            GChart.Symbol symbol= _selectedPoints.getSymbol();
            symbol.setBorderColor("black");
            symbol.setBackgroundColor("#99ff33");
            symbol.setSymbolType(GChart.SymbolType.BOX_CENTER);

            GChart.Symbol refSym = _mainCurves.get(0).getSymbol();
            symbol.setBrushHeight(refSym.getBrushHeight());
            symbol.setBrushWidth(refSym.getBrushWidth());
            symbol.setHoverSelectionWidth(refSym.getHoverSelectionWidth());
            symbol.setHoverSelectionHeight(refSym.getHoverSelectionHeight());
            symbol.setHoverSelectionBackgroundColor(symbol.getBackgroundColor());
            symbol.setHoverSelectionBorderColor(refSym.getBorderColor());
            symbol.setHoverAnnotationSymbolType(refSym.getHoverAnnotationSymbolType());
            symbol.setHoverLocation(refSym.getHoverLocation());
            symbol.setHoverYShift(refSym.getHoverYShift());
            symbol.setHovertextTemplate(refSym.getHovertextTemplate());
            symbol.setHoverSelectionEnabled(true);
            symbol.setHoverAnnotationEnabled(true);
        } else {
            _selectedPoints.clearPoints();
            _selectedPoints.setCurveData(null);
            if (updateModel && _tableModel.getCurrentData() != null) {
                _suspendEvents = true;
                _tableModel.getCurrentData().deselectAll();
                _suspendEvents = false;
            }
        }
        _actionHelp.setHTML(_rubberbandZooms ?ZOOM_IN_HELP:SELECT_HELP);

        double x,y;
        List<XYPlotData.Point> dataPoints = selectedData.getDataPoints();

        for (XYPlotData.Point p : dataPoints) {
            x = p.getX();
            y = p.getY();
            _selectedPoints.addPoint(_xScale.getScaled(x), _yScale.getScaled(y));
        }
        _selectedPoints.setCurveData(selectedData);

        // set selected rows
        if (dataPoints.size() > 0) {
            if (updateModel && _tableModel.getCurrentData()!=null) {
                Integer [] selected = new Integer[dataPoints.size()];
                int i = 0;
                for (XYPlotData.Point p : dataPoints) {
                    selected[i] = p.getRowIdx();
                    i++;
                }
                _suspendEvents = true;
                _tableModel.getCurrentData().select(selected);
                _suspendEvents = false;
            }
            if (selectedData.getXMinMax() != null && selectedData.getYMinMax() != null &&
                    _data.getXCol().length()>0 && _data.getYCol().length() > 0) {
                // need X and Y range to filter
                // can not filter if X or Y is an expression
                _filterSelectedLink.setVisible(true);
            }
            _actionHelp.setHTML(UNSELECT_HELP);
        } else {
            _filterSelectedLink.setVisible(false);
        }
        _chart.update();
    }


    private void filterSelected() {

        // can filter when there are some selected points and when both x and y are not expressions
        if (_selectedPoints == null || _chart.getCurveIndex(_selectedPoints) < 0 || _selectedPoints.getNPoints()<1) {
            PopupUtil.showError("Nothing to filter", "Nothing selected");
            return;
        } else if (_data == null || _data.getXCol().length()==0 || _data.getYCol().length()==0) {
            PopupUtil.showError("Unable to filter", "X or Y column is an expression. Unable to filter expressions.");
            return;
        }
        if (_chart.getCurveIndex(_selectedPoints)>=0 &&
                _selectedPoints.getNPoints()>0 &&
                _data.getXCol().length()>0 && _data.getYCol().length()>0) {
            SelectedData selectedData = (SelectedData)_selectedPoints.getCurveData();
            MinMax xMinMax = selectedData.getXMinMax();
            MinMax yMinMax = selectedData.getYMinMax();
            if (xMinMax == null || yMinMax == null) {
                PopupUtil.showError("Unable to filter", "No X/Y range is saved for the selected points.");
                return;
            }
            String xCol = _data.getXCol();
            String yCol = _data.getYCol();

            List<String> currentFilters = _tableModel.getFilters();
            currentFilters.add(xCol+" > "+XYPlotData.formatValue(xMinMax.getMin()));
            currentFilters.add(xCol+" < "+XYPlotData.formatValue(xMinMax.getMax()));
            currentFilters.add(yCol+" > "+XYPlotData.formatValue(yMinMax.getMin()));
            currentFilters.add(yCol+" < "+XYPlotData.formatValue(yMinMax.getMax()));
            if (_tableModel.getCurrentData() != null) {
                _tableModel.getCurrentData().deselectAll();
            }
             _tableModel.fireDataStaleEvent();
            _filterSelectedLink.setVisible(false);
        } else {
            PopupUtil.showError("Unable to filter", "Unable to Filter");
        }
    }

    public void toggleFilters() {
        if (popoutFilters == null) {
            final FilterPanel filterPanel = new FilterPanel(getColumns());
            popoutFilters = new FilterDialog(_filters, filterPanel);
            popoutFilters.setApplyListener(new GeneralCommand("Apply") {
                        @Override
                        protected void doExecute() {
                            _tableModel.setFilters(filterPanel.getFilters());
                            if (_tableModel.getCurrentData() != null) {
                                _tableModel.getCurrentData().deselectAll();
                            }
                            _tableModel.fireDataStaleEvent();
                        }
                    });

        }
        if (popoutFilters.isVisible()) {
            popoutFilters.setVisible(false);
        } else {
            popoutFilters.getFilterPanel().setFilters(_tableModel.getFilters());
            popoutFilters.show(0, PopupPane.Align.BOTTOM_LEFT);
        }
    }

    public List<String> getFilters() {
        return _tableModel.getFilters();
    }

    public void clearFilters() {
        _tableModel.setFilters(null);
        if (_tableModel.getCurrentData() != null) {
            _tableModel.getCurrentData().deselectAll();
        }
        _tableModel.fireDataStaleEvent();
    }


    private static class ShowColumnsDialog extends BaseDialog {

        public ShowColumnsDialog(Widget parent, List<TableDataView.Column> cols) {
            super(parent, ButtonType.REMOVE, "Available columns", "visualization.xyplotViewer");
            Button b = this.getButton(BaseDialog.ButtonID.REMOVE);
            b.setText("Close");

            BaseTableData defTD = new BaseTableData(new String[]{"Column", "Units", "Type", "Description"});
            for (TableDataView.Column c : cols) {
                String units = c.getUnits();
                defTD.addRow(new String[]{c.getName(), StringUtils.isEmpty(units)? "" : units, c.getType(), c.getShortDesc()});
            }
            DataSet defDS = new DataSet(defTD);
            BasicTable table = new BasicTable(defDS);
            table.setColumnWidth(0, 80);
            table.setColumnWidth(1, 50);
            table.setColumnWidth(2, 50);
            table.setColumnWidth(3, 100);
            table.addStyleName("expand-fully");
            InfoPanel infoPanel = new InfoPanel();
            //infoPanel.setSize("310px", "310px");
            infoPanel.setWidget(table);
            setWidget(infoPanel);
            setDefaultContentSize(330, 200);
        }
    }

    private static class InfoPanel extends SimplePanel implements RequiresResize {
        public void onResize() {
            String height = this.getParent().getOffsetHeight()+"px";
            String width = this.getParent().getOffsetWidth()+"px";
            this.setSize(width, height);
            Widget w = this.getWidget();
            if (w instanceof BasicTable) {
                resizeTable((BasicTable) w, getParent().getOffsetWidth(),getParent().getOffsetHeight());
            }
        }

        private void resizeTable(BasicTable t, int width, int height) {
            int colCount= t.getDataTable().getColumnCount();
            int beforeLastColumnWidth = 0;
            int lastColWidth;
            if (colCount > 1) {
                for (int i=0; i<colCount-1;i++) {
                    beforeLastColumnWidth += t.getColumnWidth(i);
                }
                lastColWidth = width - beforeLastColumnWidth;
                if (lastColWidth > 50) {
                    t.setColumnWidth(colCount-1, lastColWidth-50);
                }
            }
            t.setSize(width+"px", height+"px");
        }
    }

    public static class SelectedData {
        MinMax _xMinMax;
        MinMax _yMinMax;
        List<XYPlotData.Point> _dataPoints;
        SelectedData(MinMax xMinMax, MinMax yMinMax, List<XYPlotData.Point> dataPoints) {
            _xMinMax = xMinMax;
            _yMinMax = yMinMax;
            _dataPoints = dataPoints;
        }

        MinMax getXMinMax() {return _xMinMax;}
        MinMax getYMinMax() {return _yMinMax;}
        List<XYPlotData.Point> getDataPoints() { return _dataPoints; }
    }
}
