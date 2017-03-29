/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get, set} from 'lodash';
import React, {PropTypes} from 'react';
import * as TblUtil from '../../tables/TableUtil.js';

import {LO_MODE, LO_VIEW, dispatchSetLayoutMode} from '../../core/LayoutCntlr.js';
import {HelpIcon} from '../../ui/HelpIcon.jsx';
import {ToolbarButton} from '../../ui/ToolbarButton.jsx';

import * as ChartsCntlr from '../ChartsCntlr.js';

import {HistogramOptions} from '../ui/HistogramOptions.jsx';
import {Histogram} from '../ui/Histogram.jsx';
import {HistogramPlotly} from '../ui/HistogramPlotly.jsx';
import {getChartProperties, updateOnStoreChange, FilterEditorWrapper} from './TblView.jsx';
import {getAppOptions} from '../../core/AppDataCntlr.js';

import OUTLINE_EXPAND from 'html/images/icons-2014/24x24_ExpandArrowsWhiteOutline.png';
import SETTINGS from 'html/images/icons-2014/24x24_GearsNEW.png';
import CLEAR_FILTERS from 'html/images/icons-2014/24x24_FilterOff_Circle.png';
import FILTER from 'html/images/icons-2014/24x24_Filter.png';
import LOADING from 'html/images/gxt/loading.gif';

export const HISTOGRAM_TBLVIEW = {
    id : 'histogram',
    Chart,
    Options,
    Toolbar,
    getChartProperties,
    updateOnStoreChange
};



function Chart(props) {
    const {chartId, tblId, chartData, widthPx, heightPx} = props;
    if (!TblUtil.isFullyLoaded(tblId) || !chartData || !heightPx || !widthPx) {
        return (<div/>);
    }
    var { isDataReady, data:histogramData, options:histogramParams} = ChartsCntlr.getChartDataElement(chartId);
    const HistogramInstance = get(getAppOptions(), 'charts.chartEngine') !== 'plotly' ? Histogram : HistogramPlotly;
    const unit = get(TblUtil.getColumn(TblUtil.getTblById(tblId), histogramParams.columnOrExpr), 'units');

    if (isDataReady) {
        var logs;
        const xAxis = histogramParams.xAxis || {reversed: false, opposite: false};
        const yAxis = histogramParams.yAxis || {reversed: false, opposite: false};
        if (histogramParams) {
            var logvals = '';
            if (histogramParams.x.includes('log')) { logvals += 'x';}
            if (histogramParams.y.includes('log')) { logvals += 'y';}
            if (logvals.length>0) { logs = logvals;}

            if (histogramParams.x.includes('flip')) { set(xAxis, 'reversed', true); }
            if (histogramParams.y.includes('flip')) { set(yAxis, 'reversed', true); }

            if (histogramParams.x.includes('opposite')) { set(xAxis, 'opposite', true); }
            if (histogramParams.y.includes('opposite')) { set(yAxis, 'opposite', true); }
        }

        return (
            <HistogramInstance data={histogramData}
                               desc={histogramParams.columnOrExpr}
                               binColor='#8c8c8c'
                               height={heightPx}
                               width={widthPx}
                               logs={logs}
                               xAxis={xAxis}
                               yAxis={yAxis}
                               xUnit={unit}
            />
        );
    } else {
        if (histogramParams) {
            return <div style={{position: 'relative', width: '100%', height: '100%'}}><div className='loading-mask'/></div>;
        } else {
            return <div/>;
        }
    }
}

Chart.propTypes = {
    chartId: PropTypes.string,
    chartData : PropTypes.object,
    tblId : PropTypes.string,
    widthPx : PropTypes.number,
    heightPx : PropTypes.number
};

function Options({chartId, optionsKey}) {
    if (optionsKey === 'options') {
        const {tblStatsData} = getChartProperties(chartId);
        if (get(tblStatsData,'isColStatsReady')) {
            const chartDataElement = ChartsCntlr.getChartDataElement(chartId);
            const chartDataElementId = chartDataElement.id;
            const formName = `chartOpt-${chartId}`;
            return (
                <HistogramOptions key={formName}
                                  groupKey={formName}
                                  colValStats={tblStatsData.colStats}
                                  histogramParams={get(chartDataElement, 'options')}
                                  defaultParams={get(chartDataElement, 'defaultOptions')}
                                  onOptionsSelected={(options) => {
                                        ChartsCntlr.dispatchChartOptionsReplace({chartId, chartDataElementId, newOptions: options});
                                  }}
                />
            );
        } else {
            return (
                <img style={{verticalAlign:'top', height: 16, padding: 10, float: 'left'}}
                     title='Loading Options...'
                     src={LOADING}
                />);
        }
    } else if (optionsKey === 'filters') {
        const {tableModel} = getChartProperties(chartId);
        return (
            <FilterEditorWrapper tableModel={tableModel}/>
        );
    }
}

Options.propTypes = {
    chartId: PropTypes.string,
    optionsKey: PropTypes.string
};

function Toolbar({chartId, expandable, expandedMode, toggleOptions}) {
    const {tableModel, help_id} = getChartProperties(chartId);
    return (
        <div className={`PanelToolbar ChartPanel__toolbar ${expandedMode?'ChartPanel__toolbar--offsetLeft':''}`}>
            <div className='PanelToolbar__group'/>
            <div className='PanelToolbar__group'>
                {TblUtil.getFilterCount(tableModel)>0 &&
                <img className='PanelToolbar__button'
                     title='Remove all filters'
                     src={CLEAR_FILTERS}
                     onClick={() => TblUtil.clearFilters(tableModel)}
                />}
                <ToolbarButton icon={FILTER}
                               tip='Show/edit filters'
                               visible={true}
                               badgeCount={TblUtil.getFilterCount(tableModel)}
                               onClick={() => toggleOptions('filters')}/>
                <img className='PanelToolbar__button'
                     title='Chart options and tools'
                     src={SETTINGS}
                     onClick={() => toggleOptions('options')}
                />
                { expandable && !expandedMode &&
                <img className='PanelToolbar__button'
                     title='Expand this panel to take up a larger area'
                     src={OUTLINE_EXPAND}
                     onClick={() =>
                     {
                          ChartsCntlr.dispatchChartExpanded(chartId);
                          dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.xyPlots);
                     }}
                />}

                { help_id && <div style={{display: 'inline-block', position: 'relative', top: 0, alignSelf: 'baseline', padding: 2}}> <HelpIcon helpId={help_id} /> </div>}

            </div>
        </div>
    );
}

Toolbar.propTypes = {
    chartId: PropTypes.string,
    expandable: PropTypes.bool,
    expandedMode: PropTypes.bool,
    toggleOptions: PropTypes.func // callback: toggleOptions(optionsKey)
};