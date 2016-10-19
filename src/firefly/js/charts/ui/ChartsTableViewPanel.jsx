/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import './ChartPanel.css';
import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
// import {deepDiff} from '../util/WebUtil.js';
import {get, debounce, defer, isBoolean, isUndefined} from 'lodash';
import Resizable from 'react-component-resizable';
import {flux} from '../../Firefly.js';
import * as TablesCntlr from '../../tables/TablesCntlr.js';
import * as TblUtil from '../../tables/TableUtil.js';
import {SelectInfo} from '../../tables/SelectInfo.js';
import {FilterInfo} from '../../tables/FilterInfo.js';
import {FilterEditor} from '../../tables/ui/FilterEditor.jsx';
import {ToolbarButton} from '../../ui/ToolbarButton.jsx';
import * as TableStatsCntlr from '../TableStatsCntlr.js';
import * as XYPlotCntlr from '../dataTypes/XYColsCDT.js';
import * as ChartsCntlr from '../ChartsCntlr.js';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode} from '../../core/LayoutCntlr.js';
import {HelpIcon} from '../../ui/HelpIcon.jsx';
import {SCATTER, getHighlighted} from '../ChartUtil.js';
import {XYPlotOptions} from './XYPlotOptions.jsx';
import {XYPlot} from './XYPlot.jsx';
import {HistogramOptions} from './HistogramOptions.jsx';
import {Histogram} from './Histogram.jsx';
import {showInfoPopup} from '../../ui/PopupUtil.jsx';
import DELETE from 'html/images/blue_delete_10x10.png';
import OUTLINE_EXPAND from 'html/images/icons-2014/24x24_ExpandArrowsWhiteOutline.png';
import SETTINGS from 'html/images/icons-2014/24x24_GearsNEW.png';
import ZOOM_IN from 'html/images/icons-2014/24x24_ZoomIn.png';
import ZOOM_ORIGINAL from 'html/images/icons-2014/Zoom1x-24x24-tmp.png';
import SELECT_ROWS from 'html/images/icons-2014/24x24_Checkmark.png';
import UNSELECT_ROWS from 'html/images/icons-2014/24x24_CheckmarkOff_Circle.png';
import FILTER_IN from 'html/images/icons-2014/24x24_FilterAdd.png';
import CLEAR_FILTERS from 'html/images/icons-2014/24x24_FilterOff_Circle.png';
import FILTER from 'html/images/icons-2014/24x24_Filter.png';
import LOADING from 'html/images/gxt/loading.gif';

class ChartsPanel extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            optionsShown: false,
            filtersShown: false
        };

        const normal = (size) => {
            if (size && this.iAmMounted) {
                var widthPx = size.width;
                var heightPx = size.height;
                //console.log('width: '+widthPx+', height: '+heightPx);
                if (widthPx !== this.state.widthPx || heightPx !== this.state.heightPx) {
                    this.setState({widthPx, heightPx});
                }
            }
        };
        const debounced = debounce(normal, 100);
        this.onResize =  (size) => {
            if (this.state.widthPx === 0) {
                defer(normal, size);
            } else {
                debounced(size);
            }
        };

        this.renderXYPlot = this.renderXYPlot.bind(this);
        this.renderHistogram = this.renderHistogram.bind(this);
        this.toggleOptions = this.toggleOptions.bind(this);
        this.toggleFilters = this.toggleFilters.bind(this);
        this.displaySelectionOptions = this.displaySelectionOptions.bind(this);
        this.displayZoomOriginal = this.displayZoomOriginal.bind(this);
        this.addSelection = this.addSelection.bind(this);
        this.resetSelection = this.resetSelection.bind(this);
        this.getFilterCount = this.getFilterCount.bind(this);
        this.addFilter = this.addFilter.bind(this);
        this.clearFilters = this.clearFilters.bind(this);
        this.selectionNotEmpty = this.selectionNotEmpty.bind(this);
        this.renderSelectionButtons = this.renderSelectionButtons.bind(this);
        this.renderToolbar = this.renderToolbar.bind(this);
        this.renderOptions = this.renderOptions.bind(this);
    }

    shouldComponentUpdate(nextProps, nextState) {
        let doUpdate = nextState !== this.state ||
            nextProps.chartData !== this.props.chartData ||
            nextProps.tblStatsData !== this.props.tblStatsData ||
            nextProps.expandedMode !== this.props.expandedMode ||
            nextProps.deletable !== this.props.deletable;
        if (!doUpdate) {
            const {chartType} = nextProps;
            if (chartType === SCATTER) {
                // scatter plot
                doUpdate =
                    (nextProps.tableModel && TblUtil.isFullyLoaded(nextProps.tableModel.tblId) &&
                    (nextProps.tableModel.highlightedRow !== get(this.props, 'tableModel.highlightedRow') ||
                     nextProps.tableModel.selectInfo !== get(this.props, 'tableModel.selectInfo') ));
            }
        }
        return Boolean(doUpdate);
    }

    componentDidMount() {
        const {chartId} = this.props;
        ChartsCntlr.dispatchChartMounted(chartId);
        this.iAmMounted = true;
    }

    componentWillReceiveProps(nextProps) {
        const {tblId, chartId} = nextProps;
        if (!tblId || !chartId) { return; }

        if (chartId !== this.props.chartId) {
            ChartsCntlr.dispatchChartUnmounted(this.props.chartId);
            ChartsCntlr.dispatchChartMounted(chartId);
        }
        if (get(ChartsCntlr.getChartDataElement(chartId), 'data') !== get(ChartsCntlr.getChartDataElement(this.props.chartId), 'data')) {
            this.setState({optionsShown: false});
        }
    }

    componentWillUnmount() {
        this.iAmMounted = false;
        const {chartId} = this.props;
        ChartsCntlr.dispatchChartUnmounted(chartId);
    }

    // -------------
    // SCATTER PLOT
    // -------------

    renderXYPlot() {
        const {chartId, tblId, tableModel, chartData} = this.props;
        if (!TblUtil.isFullyLoaded(tblId) || !chartData) {
            return null;
        }
        const { isDataReady:isPlotDataReady, data:xyPlotData, options:xyPlotParams} = ChartsCntlr.getChartDataElement(chartId);
        var {widthPx, heightPx} = this.state;

        const hRow = getHighlighted(xyPlotParams, tblId);
        const sInfo = tableModel && tableModel.selectInfo;

        if (isPlotDataReady) {
            if (!heightPx || !widthPx) { return (<div/>); }
            return (
                <XYPlot data={xyPlotData}
                        desc=''
                        width={widthPx}
                        height={heightPx}
                        params={xyPlotParams}
                        highlighted={hRow}
                        onHighlightChange={(highlightedRow) => {
                                    TablesCntlr.dispatchTableHighlight(tblId, highlightedRow);
                                }
                           }
                        selectInfo={sInfo}
                        onSelection={(selection) => {
                            if (this.selectionNotEmpty(selection)) {defer(XYPlotCntlr.setXYSelection, chartId, undefined, selection);}
                        }}
                />
            );
        } else {
            if (xyPlotParams) {
                return <div style={{position: 'relative', width: '100%', height: '100%'}}><div className='loading-mask'/></div>;
            } else {
                return null;
            }
        }

    }

    // ----------
    // HISTOGRAM
    // ----------


    renderHistogram() {
        const {chartId, tblId, chartData} = this.props;
        if (!TblUtil.isFullyLoaded(tblId) || !chartData) {
            return null;
        }
        const { isDataReady:isColDataReady, data:histogramData, options:histogramParams} = ChartsCntlr.getChartDataElement(chartId);

        var {widthPx, heightPx} = this.state;

        if (isColDataReady) {
            var logs, reversed;
            if (histogramParams) {
                var logvals = '';
                if (histogramParams.x.includes('log')) { logvals += 'x';}
                if (histogramParams.y.includes('log')) { logvals += 'y';}
                if (logvals.length>0) { logs = logvals;}

                var rvals = '';
                if (histogramParams.x.includes('flip')) { rvals += 'x';}
                if (histogramParams.y.includes('flip')) { rvals += 'y';}
                if (rvals.length>0) { reversed = rvals;}

            }

            if (!heightPx || !widthPx) { return (<div/>); }
            return (
                <Histogram data={histogramData}
                           desc={histogramParams.columnOrExpr}
                           binColor='#8c8c8c'
                           height={heightPx}
                           width={widthPx}
                           logs={logs}
                           reversed={reversed}
                />
            );
        } else {
            if (histogramParams) {
                return <div style={{position: 'relative', width: '100%', height: '100%'}}><div className='loading-mask'/></div>;
            } else {
                return 'Select Histogram Parameters';
            }
        }
    }

    // -----------------
    // COMMON RENDERING
    // -----------------

    toggleOptions() {
        const {optionsShown} = this.state;
        this.setState({optionsShown: !optionsShown, filtersShown: false});
    }

    toggleFilters() {
        const {filtersShown} = this.state;
        this.setState({optionsShown: false, filtersShown: !filtersShown});
    }

    displaySelectionOptions() {
        if (this.props.chartType === SCATTER) {
            const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
            const selection = get(chartDataElement, 'options.selection');
            return Boolean(selection);
        }
        // for now selection is supported for scatter only
        return false;
    }

    displayZoomOriginal() {
        if (this.props.chartType === SCATTER) {
            const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
            const zoom = get(chartDataElement, 'options.zoom');
            return Boolean(zoom);
        }
        // for now zoom is supported for scatter only
        return false;
    }

    addZoom() {
        if (this.props.chartType === SCATTER) {
            const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
            const chartDataElementId = chartDataElement.id;
            XYPlotCntlr.setZoom(this.props.chartId, chartDataElementId, get(chartDataElement, 'options.selection'));
        }
    }

    resetZoom() {
        if (this.props.chartType === SCATTER) {
            const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
            const chartDataElementId = chartDataElement.id;
            XYPlotCntlr.setZoom(this.props.chartId, chartDataElementId);
        }
    }

    displayUnselectAll  () {
        if (this.props.chartType === SCATTER) {
            const selectInfo = get(this.props, 'tableModel.selectInfo');
            return selectInfo && (selectInfo.selectAll || selectInfo.exceptions.size>0);
        }
    }

    addSelection() {
        if (this.props.chartType === SCATTER) {
            const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
            if (get(chartDataElement,'data.decimateKey')) {
                showInfoPopup('Your data set is too large to select. You must filter it down first.',
                                `Can't Select`); // eslint-disable-line quotes
            } else {
                const {tblId, tableModel} = this.props;
                const selection = get(chartDataElement, 'options.selection');
                const rows = get(chartDataElement,'data.rows');
                if (tableModel && rows && selection) {
                    const {xMin, xMax, yMin, yMax} = selection;
                    const selectInfoCls = SelectInfo.newInstance({rowCount: tableModel.totalRows});
                    // add all rows which fall into selection
                    const xIdx = 0, yIdx = 1, rowIdx = 2;
                    rows.forEach((arow) => {
                        const x = Number(arow[xIdx]);
                        const y = Number(arow[yIdx]);
                        if (x >= xMin && x <= xMax && y >= yMin && y <= yMax) {
                            selectInfoCls.setRowSelect(Number(arow[rowIdx]), true);
                        }
                    });
                    const selectInfo = selectInfoCls.data;
                    TablesCntlr.dispatchTableSelect(tblId, selectInfo);
                }
            }
        }
    }

    resetSelection() {
        if (this.props.chartType === SCATTER) {
            const {tblId, tableModel} = this.props;
            if (tableModel) {
                const selectInfoCls = SelectInfo.newInstance({rowCount: tableModel.totalRows});
                TablesCntlr.dispatchTableSelect(tblId, selectInfoCls.data);
            }
        }
    }

    getFilterCount() {
        const filterInfo = get(this.props, 'tableModel.request.filters');
        const filterCount = filterInfo ? filterInfo.split(';').length : 0;
        return filterCount;
    }

    addFilter() {
        if (this.props.chartType === SCATTER) {
            const {chartId, tableModel} = this.props;
            const chartDataElement = ChartsCntlr.getChartDataElement(chartId);

            const options = get(chartDataElement, 'options');
            const selection = get(options, 'selection');
            const xCol = get(options, 'x.columnOrExpr');
            const yCol = get(options, 'y.columnOrExpr');
            if (selection && xCol && yCol) {
                const {xMin, xMax, yMin, yMax} = selection;
                const filterInfo = get(this.props, 'tableModel.request.filters');
                const filterInfoCls = FilterInfo.parse(filterInfo);
                filterInfoCls.setFilter(xCol, '> '+xMin);
                filterInfoCls.addFilter(xCol, '< '+xMax);
                filterInfoCls.setFilter(yCol, '> '+yMin);
                filterInfoCls.addFilter(yCol, '< '+yMax);
                const newRequest = Object.assign({}, tableModel.request, {filters: filterInfoCls.serialize()});
                TablesCntlr.dispatchTableFilter(newRequest, 0);
            }
        }
    }

    clearFilters() {
        const request = get(this.props, 'tableModel.request');
        if (request && request.filters) {
            const newRequest = Object.assign({}, request, {filters: ''});
            TablesCntlr.dispatchTableFilter(newRequest, 0);
        }
    }

    selectionNotEmpty(selection) {
        const chartDataElement = ChartsCntlr.getChartDataElement(this.props.chartId);
        const rows = get(chartDataElement, 'data.rows');
        if (rows) {
            if (selection) {
                const {xMin, xMax, yMin, yMax} = selection;
                const xIdx = 0, yIdx = 1;
                const aPt = rows.find((arow) => {
                    const x = Number(arow[xIdx]);
                    const y = Number(arow[yIdx]);
                    return (x >= xMin && x <= xMax && y >= yMin && y <= yMax);
                });
                return Boolean(aPt);
            } else {
                return true; // empty selection replacing non-empty
            }
        } else {
            return false;
        }

    }

    renderSelectionButtons() {
        if (this.displaySelectionOptions()) {
            return (
                <div style={{display:'inline-block', whiteSpace: 'nowrap'}}>
                    <img className='PanelToolbar__button'
                         title='Zoom in the enclosed points'
                         src={ZOOM_IN}
                         onClick={() => this.addZoom()}
                    />
                    {<img className='PanelToolbar__button'
                         title='Select enclosed points'
                         src={SELECT_ROWS}
                         onClick={() => this.addSelection()}
                    />}
                    <img className='PanelToolbar__button'
                         title='Filter in the selected points'
                         src={FILTER_IN}
                         onClick={() => this.addFilter()}
                    />
                </div>
            );
        }
    }

    renderToolbar() {
        const {expandable, expandedMode, tblId, chartId, deletable, help_id} = this.props;
        return (
            <div className='PanelToolbar ChartPanel__toolbar'>
                <div className='PanelToolbar_group'>
                    {this.renderSelectionButtons()}
                </div>
                <div className='PanelToolbar_group'>
                    {this.displayZoomOriginal() && <img className='PanelToolbar__button'
                         title='Zoom out to original chart'
                         src={ZOOM_ORIGINAL}
                         onClick={() => this.resetZoom()}
                    />}
                    {this.displayUnselectAll() && <img className='PanelToolbar__button'
                         title='Unselect all selected points'
                         src={UNSELECT_ROWS}
                         onClick={() => this.resetSelection()}
                    />}
                    {this.getFilterCount()>0 && <img className='PanelToolbar__button'
                                                   title='Remove all filters'
                                                   src={CLEAR_FILTERS}
                                                   onClick={() => this.clearFilters()}
                    />}
                    <ToolbarButton icon={FILTER}
                                   tip='Show/edit filters'
                                   visible={true}
                                   badgeCount={this.getFilterCount()}
                                   onClick={this.toggleFilters}/>
                    <img className='PanelToolbar__button'
                         title='Plot options and tools'
                         src={SETTINGS}
                         onClick={() => this.toggleOptions()}
                    />
                    { expandable && !expandedMode &&
                    <img className='PanelToolbar__button'
                         title='Expand this panel to take up a larger area'
                         src={OUTLINE_EXPAND}
                         onClick={() => {
                            ChartsCntlr.dispatchChartExpanded(chartId);
                            dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.xyPlots);
                         }}
                    />}

                    { help_id && <div style={{display: 'inline-block', position: 'relative', top: -9}}> <HelpIcon helpId={help_id} /> </div>}
                    { expandable && !expandedMode &&
                    (isBoolean(deletable) ? deletable : ChartsCntlr.getNumCharts(tblId) > 1) &&  // when deletable is undefined, use related charts criterion
                    <img style={{display: 'inline-block', position: 'relative', top: -9, alignSelf: 'baseline', padding: 2, cursor: 'pointer'}}
                         title='Delete this chart'
                         src={DELETE}
                         onClick={() => {ChartsCntlr.dispatchChartRemove(chartId);}}
                    />}
                </div>
            </div>
        );
    }


    renderOptions() {
        const {optionsShown, filtersShown} = this.state;
        const { tableModel, tblStatsData, chartData, chartId, chartType} = this.props;
        if (optionsShown) {
            return (
                <OptionsWrapper toggleOptions={this.toggleOptions}
                    {...{chartId, tableModel, tblStatsData, chartData, chartType}}/>
            );
        }
        if (filtersShown) {
            return (
                <FilterEditorWrapper toggleFilters={this.toggleFilters} tableModel={tableModel}/>
            );
        }
        return false;
    }



    render() {
        var {chartData, chartType} = this.props;

        if (!chartData) {
            return (<div/>);
        }

        var {widthPx, heightPx} = this.state;
        const knownSize = widthPx && heightPx;

        return (
            <div className='ChartPanel__container'>
                <div className='ChartPanel__wrapper'>
                    {this.renderToolbar()}
                    <div className='ChartPanel__chartarea'>
                        {this.renderOptions()}
                        <Resizable id='chart-resizer' onResize={this.onResize} className='ChartPanel__chartresizer'>
                            <div style={{overflow:'auto',width:widthPx,height:heightPx}}>
                                {knownSize ? chartType === SCATTER ? this.renderXYPlot() : this.renderHistogram() : <div/>}
                            </div>
                        </Resizable>
                    </div>
                </div>
            </div>
        );
    }
}

ChartsPanel.propTypes = {
    expandedMode: PropTypes.bool,
    expandable: PropTypes.bool,
    deletable : PropTypes.bool,
    help_id: PropTypes.string, // anchor to the documentation
    tblId : PropTypes.string,
    tableModel : PropTypes.object,
    tblStatsData : PropTypes.object,
    chartId: PropTypes.string,
    chartType: PropTypes.oneOf(['scatter', 'histogram']),
    chartData : PropTypes.object,
    width : PropTypes.string,
    height : PropTypes.string
};

ChartsPanel.defaultProps = {
    expandedMode: false,
    expandable: true
};



export class ChartsTableViewPanel extends Component {

    constructor(props) {
        super(props);
        this.state = this.getNextState();
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    componentDidMount() {
        this.removeListener = flux.addListener(() => this.storeUpdate());
        this.iAmMounted = true;
    }

    componentWillUnmount() {
        this.iAmMounted=false;
        this.removeListener && this.removeListener();
    }

    getNextState() {
        const {chartId} = this.props;
        const chartData =  ChartsCntlr.getChartData(chartId);
        // one data element - one related tbl id at this time
        const tblId = ChartsCntlr.getRelatedTblIds(chartId)[0];
        const tableModel = TblUtil.getTblById(tblId);
        const tblStatsData = flux.getState()[TableStatsCntlr.TBLSTATS_DATA_KEY][tblId];
        const deletable = isBoolean(deletable) ? deletable : ChartsCntlr.getNumCharts(tblId) > 1;
        return {chartId, tblId, tableModel, tblStatsData, chartData, deletable};
    }

    storeUpdate() {
        if (this.iAmMounted) {
            this.setState(this.getNextState());
        }
    }

    render() {
        const {chartId, tblId, tableModel, tblStatsData, chartData} = this.state;

        return (
            <ChartsPanel {...this.props} {...{chartId, tblId, tableModel, tblStatsData, chartData, chartType : get(chartData, 'chartType')}}/>
        );
    }
}

ChartsTableViewPanel.propTypes = {
    chartId: PropTypes.string.isRequired,
    deletable: PropTypes.bool, // should the chart be deletable?
    chartType: PropTypes.oneOf(['scatter', 'histogram'])
};

export class OptionsWrapper extends React.Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(nProps) {
        return nProps.chartId !== this.props.chartId ||
        get(ChartsCntlr.getChartDataElement(nProps.chartId), 'options') !== get(ChartsCntlr.getChartDataElement(this.props.chartId), 'options') ||
        get(nProps, 'tableModel.tbl_id') !== get(this.props, 'tableModel.tbl_id') ||
            get(nProps, 'tblStatsData.isColStatsReady') !== get(this.props, 'tblStatsData.isColStatsReady') ||
            nProps.chartType !== this.props.chartType;
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    render() {
        const { chartId, tblStatsData, chartType, toggleOptions} = this.props;
        const chartDataElement = ChartsCntlr.getChartDataElement(chartId);
        const chartDataElementId = chartDataElement.id;

        var options;

        if (get(tblStatsData,'isColStatsReady')) {
            const formName = 'ChartOpt_' + chartType + chartId;
            if (chartType === SCATTER) {
                options = (<XYPlotOptions key={formName} groupKey={formName}
                                   colValStats={tblStatsData.colStats}
                                   xyPlotParams={get(chartDataElement, 'options')}
                                   defaultParams={get(chartDataElement, 'defaultOptions')}
                                   onOptionsSelected={(options) => {
                                                ChartsCntlr.dispatchChartOptionsReplace({chartId, chartDataElementId, newOptions: options});
                                            }
                                          }/>);
            } else {
                options = (<HistogramOptions key={formName} groupKey={formName}
                                      colValStats={tblStatsData.colStats}
                                      histogramParams={get(chartDataElement, 'options')}
                                      defaultParams={get(chartDataElement, 'defaultOptions')}
                                      onOptionsSelected={(options) => {
                                                ChartsCntlr.dispatchChartOptionsReplace({chartId, chartDataElementId, newOptions: options});
                                            }
                                          }/>);
            }
        } else {
            options = (<img style={{verticalAlign:'top', height: 16, padding: 10, float: 'left'}}
                         title='Loading Options...'
                            src={LOADING}/>);
        }

        return (
            <div className='ChartPanelOptions'>
                {toggleOptions &&
                    <div style={{height: 14}}>
                        <div style={{ right: -6, float: 'right'}}
                             className='btn-close'
                             title='Remove Panel'
                             onClick={() => toggleOptions()}/>
                    </div>
                }
                {options}
            </div>
        );
    }
}

OptionsWrapper.propTypes = {
    chartId : PropTypes.string,
    tableModel : PropTypes.object,
    tblStatsData : PropTypes.object,
    chartData : PropTypes.object,
    toggleOptions: PropTypes.func,
    chartType: PropTypes.string
};


export class FilterEditorWrapper extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            sortInfo: ''
        };
    }

    shouldComponentUpdate(np, ns) {
        const tblId = get(np.tableModel, 'tbl_id');
        return ns.sortInfo !== this.state.sortInfo || tblId !== get(this.props.tableModel, 'tbl_id') ||
            (TblUtil.isFullyLoaded(tblId) && np.tableModel !== this.props.tableModel); // to avoid flickering when changing the filter
    }

    render() {
        const {tableModel, toggleFilters} = this.props;
        const {sortInfo} = this.state;
        return (
            <div className='ChartPanelOptions'>
                <div style={{height: 14}}>
                    <div style={{ right: -6, float: 'right'}}
                         className='btn-close'
                         title='Remove Panel'
                         onClick={() => toggleFilters()}/>
                </div>
                <div style={{width: 350, height: 'calc(100% - 20px)'}}>
                    <FilterEditor
                        columns={get(tableModel, 'tableData.columns', [])}
                        selectable={false}
                        filterInfo={get(tableModel, 'request.filters')}
                        sortInfo={sortInfo}
                        onChange={(obj) => {
                            if (!isUndefined(obj.filterInfo)) {
                                const newRequest = Object.assign({}, tableModel.request, {filters: obj.filterInfo});
                                TablesCntlr.dispatchTableFilter(newRequest, 0);
                            } else if (!isUndefined(obj.sortInfo)) {
                                this.setState({sortInfo: obj.sortInfo});
                            }
                          } }/>
                </div>
            </div>
        );
    }
}

FilterEditorWrapper.propTypes = {
    toggleFilters : PropTypes.func,
    tableModel : PropTypes.object
};