import {isUndefined, get, has, omit} from 'lodash';
import shallowequal from 'shallowequal';
import React, {PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';

import {PlotlyWrapper} from './PlotlyWrapper.jsx';

import {SelectInfo} from '../../tables/SelectInfo.js';
import {parseDecimateKey} from '../../tables/Decimate.js';

import numeral from 'numeral';
import {getFormatString} from '../../util/MathUtil.js';

import {plotParamsShape, plotDataShape} from './XYPlotPropTypes.js';
import {calculateChartSize,
    getXAxisOptions, getYAxisOptions, getZoomSelection, formatError, isLinePlot, plotErrors,
    selFiniteMin, selFiniteMax} from './XYPlot.jsx';



const defaultShading = 'lin';

const PLOTLY_CONFIG = {displayModeBar: false};

const DATAPOINTS = 'data';
const DATAPOINTS_HEATMAP = 'data_heatmap';
const SELECTED = 'selected';
const HIGHLIGHTED = 'highlighted';

const datapointsColor = 'rgba(63, 127, 191, 0.5)';
const datapointsColorWithErrors = 'rgba(63, 127, 191, 0.7)';
const selectedColorWithErrors = 'rgba(255, 200, 0, 1)';
const selectedColor = 'rgba(255, 200, 0, 1)';
const highlightedColor = 'rgba(255, 165, 0, 1)';
const selectionRectColor = 'rgba(255, 209, 128, 0.5)';
const selectionRectColorGray = 'rgba(165, 165, 165, 0.5)';

const Y_TICKLBL_PX = 80;
const X_TICKLBL_PX = 60;
const MIN_MARGIN_PX = 10;
const MIN_YLBL_PX = 30;
const FSIZE = 12;


/**
 * Get range for a plotly axis
 * Plotly requires range to be reversed if the axis is reversed,
 * and limits to be log if axis scale is log
 * @param min - minimum value
 * @param max - maximum value
 * @param isLog - true, if an axis uses log scale
 * @param isReversed - true, if the axis should be reversed
 * @returns {Array<number>} an array for axis range property in plotly layout
 */
function getRange(min, max, isLog, isReversed) {
    const [r1, r2] = isReversed ? [max, min] : [min, max];
    return isLog ? [Math.log10(r1), Math.log10(r2)] : [r1, r2];
}

/**
 * A function to make plotly data for the given properties
 * @param props
 * @returns {{plotlyData: Array, toRowIdx: Map}} plotly data array
 */
function makeSeries(props) {
    const {data, params, selectInfo, highlighted} = props;
    const {rows, decimateKey, weightMin, weightMax} = data;
    let toRowIdx = undefined; //the map from decimate key of a bin to rowIdx

    if (rows.length < 1) { return []; }

    const allSeries = [];

    const highlightedData = [];
    if (!isUndefined(highlighted)) {
        highlightedData.push(highlighted);
    }

    if (!decimateKey) {
        const hasXErrors = plotErrors(params, 'x');
        const hasYErrors = plotErrors(params, 'y');
        const hasErrorBars = hasXErrors || hasYErrors;

        let selectedRows = [];
        if (selectInfo) {
            const selectInfoCls = SelectInfo.newInstance(selectInfo, 0);

            selectedRows = rows.reduce((selrows, arow) => {
                if (selectInfoCls.isSelected(arow['rowIdx'])) {
                    selrows.push(arow);
                }
                return selrows;
            }, []);
        }

        const errorAxes = ['x','y'];
        const errors = errorAxes.map((axis) => {
            const err = {visible: false};
            if (get(params, [axis, 'error']) || get(params, [axis, 'errorLow']) || get(params, [axis, 'errorHigh'])) {
                err.visible = true;
                err.type = 'data';
                err.color = datapointsColorWithErrors;
                err.thickness = 1;
                err.width = (rows.length > 20) ? 0 : 3;
                if (get(params, [axis, 'error'])) {
                    err.symmetric = true;
                    err.array = rows.map((r) =>{return r[`${axis}Err`];});
                } else {
                    err.symmetric = false;
                    if (get(params, [axis, 'errorHigh'])) {
                        err.array = rows.map((r) => {return r[`${axis}ErrHigh`];});
                    }
                    if (get(params, [axis, 'errorLow'])) {
                        err.arrayminus = rows.map((r) => {return r[`${axis}ErrLow`];});
                    }
                }
            }
            return err;
        });

        const x = [];
        const y = [];
        rows.forEach((r) => {
            x.push(r.x);
            y.push(r.y);
        });

        allSeries.push({
            name: DATAPOINTS,
            type: 'scatter',
            hoverinfo: 'text',
            mode: !isLinePlot(params.plotStyle)? 'markers' : (params.plotStyle === 'line' ? 'lines' : 'lines+markers'),
            marker: {
                symbol: 'circle',
                size: 6,
                color: hasErrorBars? datapointsColorWithErrors : datapointsColor
            },
            showlegend: false,
            error_x: errors[0],
            error_y: errors[1],
            x,
            y,
            text: generateTooltips(props)
        });
        allSeries.push({
            name: SELECTED,
            type: 'scatter',
            hoverinfo: 'skip',
            mode: 'markers',
            marker: {
                symbol: 'circle',
                size: 6,
                color: hasErrorBars? selectedColorWithErrors : selectedColor
            },
            showlegend: false,
            x: selectedRows.map((r)=>r['x']),
            y: selectedRows.map((r)=>r['y'])
        });
    } else {
        const {xMin, xUnit, nX, yMin, yUnit, nY} = parseDecimateKey(decimateKey);
        // get center point of the bin
        const getCenter = (xval,yval) => {
            return {
                // bitwise operators convert operands to 32-bit integer
                // hence they can be used as a fast way to truncate a float to an integer
                x: xMin+(~~((xval-xMin)/xUnit)+0.5)*xUnit,
                y: yMin+(~~((yval-yMin)/yUnit)+0.5)*yUnit
            };
        };

        const x = [];
        const y = [];
        const z = [];
        rows.forEach((r) => {
            const centerPt = getCenter(r.x, r.y);
            x.push(centerPt.x);
            y.push(centerPt.y);
            z.push(r.weight);
        });

        toRowIdx = new Map();
        // map decimate key (bin identifier in the form 'x:y') to rowIdx
        rows.forEach((r) => {
            toRowIdx.set(r.decimate_key, r.rowIdx);
        });

        //make sure the values are populated for the bins with 0 x or y index
        for (let i=0; i<nX; i++ ) {
            for (let j = 0; j < nY; j++) {
                if (!toRowIdx.has(`${i}:${j}`)) {
                    x.push(xMin+(i+0.5)*xUnit);
                    y.push(yMin+(j+0.5)*yUnit);
                    z.push(undefined);
                }
            }
        }

        const heatmap = {
            name: DATAPOINTS_HEATMAP,
            type: 'heatmap',
            hoverinfo: 'text',
            showlegend: true,
            colorbar: {
                thickness: 10,
                outlinewidth: 0,
                title: 'pts'
            },
            x,
            y,
            z,
            text: generateTooltips(props)
        };

        if (get(params, 'shading', defaultShading) === defaultShading) {
            heatmap.colorscale = [[0, 'rgb(216,216,216)'], [1, 'rgb(40,40,40)']];
        } else if (weightMax - weightMin > 1) {
            const weightRange = weightMax - weightMin;
            const base = Math.pow(weightRange, 0.2);
            heatmap.colorscale = [
                [0, 'rgb(216,216,216)'],
                [Math.pow(base,1)/weightRange, 'rgb(189, 189, 189)'],
                [Math.pow(base,2)/weightRange, 'rgb(150, 150, 150)'],
                [Math.pow(base,3)/weightRange, 'rgb(115, 115, 115)'],
                [Math.pow(base,4)/weightRange, 'rgb(82, 82, 82)'],
                [1., 'rgb(40,40,40)']
            ];
        }
        allSeries.push(heatmap);
    }


    allSeries.push({
        name: HIGHLIGHTED,
        type: 'scatter',
        hoverinfo: 'skip',
        mode: 'markers',
        color: highlightedColor,
        marker: {symbol: 'circle', size: 8, lineColor: '#737373', lineWidth: 1, color: highlightedColor},
        x: highlightedData.map((r)=>r['x']),
        y: highlightedData.map((r)=>r['y']),
        showlegend: false
    });

    return {plotlyData: allSeries, toRowIdx};
}

/**
 * Generate tooltips
 * @param props
 * @returns {*}
 */
function generateTooltips(props) {
    const {data, params} = props;

    const {decimateKey, x, y} = data;
    const {xMin:xDataMin, xMax:xDataMax, yMin:yDataMin, yMax:yDataMax} = get(params, 'boundaries', {});

    // bin center and expression values need to be formatted
    const xFormat = (decimateKey || (x && x.match(/\W/))) ? getFormatString(Math.abs(xDataMax-xDataMin), 4) : undefined;
    const yFormat = (decimateKey || (y && y.match(/\W/))) ? getFormatString(Math.abs(yDataMax-yDataMin), 4) : undefined;

    const rows = get(props, 'data.rows');

    return rows.map((point) => {
        const weight = point.weight ? `<br> represents ${point.weight} points ` : '';
        const xval = xFormat ? numeral(point.x).format(xFormat) : point.x;
        const xerr = formatError(point.x, point.xErr, point.xErrLow, point.xErrHigh);
        const yval = yFormat ? numeral(point.y).format(yFormat) : point.y;
        const yerr = formatError(point.y, point.yErr, point.yErrLow, point.yErrHigh);
        return `<span> ${params.x.label} = ${xval} ${xerr} ${params.x.unit} <br>` +
            ` ${params.y.label} = ${yval} ${yerr} ${params.y.unit} ` +
            `${weight} </span>`;
    });
}

/**
 * Create plotly data, layout, and style
 * @param props
 * @returns {{plotlyData: Array, plotlyLayout: Object, plotlyDivStyle: Object, toRowIdx: Map}} - an object with plotly data, layout, div style, and map for decimated data
 */
function getChartingInfo(props) {
    const {params, width, height, desc} = props;

    const {chartWidth, chartHeight} = calculateChartSize(width, height, props);

    const {xTitle, xGrid, xReversed, xOpposite, xLog} = getXAxisOptions(params);
    const {yTitle, yGrid, yReversed, yOpposite, yLog} = getYAxisOptions(params);
    const {xMin, xMax, yMin, yMax} = getZoomSelection(params);
    const {xMin:xDataMin, xMax:xDataMax, yMin:yDataMin, yMax:yDataMax} = get(params, 'boundaries', {});

    const xAxisMin = selFiniteMax(xMin, xDataMin);
    const xAxisMax = selFiniteMin(xMax, xDataMax);
    const yAxisMin = selFiniteMax(yMin,yDataMin);
    const yAxisMax = selFiniteMin(yMax,yDataMax);

    const plotlyDivStyle = {
        border: '1px solid a5a5a5',
        borderRadius: 5,
        width: '100%',
        height: '100%'
    };

    const {plotlyData, toRowIdx} = makeSeries(props);

    const plotlyLayout = {
        height: chartHeight,
        width: chartWidth,
        hovermode: 'closest',
        dragmode: 'select',
        title: desc,
        //titlefont: {size: 16},
        legend: {
            font: {size: 12},
            orientation: 'v',
            yanchor: 'top'
        },
        xaxis: {
            autorange:false,
            range: getRange(xAxisMin, xAxisMax, xLog, xReversed),
            title: xTitle,
            gridLineWidth: 1,
            type: xLog ? 'log' : 'linear',
            lineColor: '#e9e9e9',
            side: xOpposite ? 'top' : 'bottom',
            tickwidth: 1,
            ticklen: 5,
            showline: true,
            showgrid: xGrid,
            titlefont: {
                size: FSIZE
            },
            tickfont: {
                size: FSIZE
            },
            zeroline: false
        },
        yaxis: {
            autorange: false,
            range: getRange(yAxisMin, yAxisMax, yLog, yReversed),
            title: yTitle,
            gridLineWidth: 1,
            type: yLog ? 'log' : 'linear',
            lineColor: '#e9e9e9',
            side: yOpposite ? 'right' : 'left',
            tickwidth: 1,
            ticklen: 5,
            showline: true,
            showgrid: yGrid,
            titlefont: {
                size: FSIZE
            },
            tickprefix: '  ',
            tickfont: {
                size: FSIZE
            },
            zeroline: false
        },
        margin: {
            l: yOpposite ? MIN_MARGIN_PX : Y_TICKLBL_PX,
            r: yOpposite ? Y_TICKLBL_PX : MIN_MARGIN_PX,
            b: xOpposite ? MIN_MARGIN_PX: X_TICKLBL_PX,
            t: xOpposite ? X_TICKLBL_PX: MIN_MARGIN_PX,
            pad: 2
        }
    };

    return {plotlyData, plotlyLayout, plotlyDivStyle, toRowIdx};

}


/**
 * Return an index of a trace with the given name
 * @param {{plotlyData: Array, plotlyLayout: Object, plotlyDivStyle: Object}} chartingInfo
 * @param {string} name - name of the trace
 * @returns {number} index of the trace
 */
function getTraceIdx(chartingInfo, name) {
    return chartingInfo.plotlyData.findIndex((t) => {return t.name === name;});
}


export class XYPlotPlotly extends React.Component {

    constructor(props) {
        super(props);

        this.state = {
            //dataUpdateTraces: undefined,
            //dataUpdate: null,
            //layoutUpdate: null
        };

        this.afterRedraw = this.afterRedraw.bind(this);
        this.adjustYMargin = this.adjustYMargin.bind(this);
        this.updateSelectionRect = this.updateSelectionRect.bind(this);
        this.onSelectionEvent = this.onSelectionEvent.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        if (this.props === nextProps || !this.chartingInfo) {  return; }

        const propsToOmit = ['onHighlightChange', 'onSelection', 'highlighted'];
        if (shallowequal(omit(this.props, propsToOmit), omit(nextProps, propsToOmit)) &&
            get(this.props,'highlighted.rowIdx') === get(nextProps,'highlighted.rowIdx')) {
            return;
        }

        const {data, width, height, params, highlighted, selectInfo, desc} = this.props;

        // re-calculate charting info when the plot data change or an error occurs
        // shading change for density plot changes series
        if (nextProps.data !== data ||
            get(params, 'plotStyle') !== get(nextProps.params, 'plotStyle') ||
            plotErrors(params, 'x') !== plotErrors(nextProps.params, 'x') ||
            plotErrors(params, 'y') !== plotErrors(nextProps.params, 'y') ||
            get(params, 'shading', defaultShading) !== get(nextProps.params, 'shading', defaultShading)) {

            this.setState({});
            this.chartingInfo = null;

        } else {

            if (this.chartingInfo) {
                // parameters are validates in parent XYPlot component

                const {params:newParams, width:newWidth, height:newHeight, highlighted:newHighlighted, selectInfo:newSelectInfo, desc:newDesc } = nextProps;

                if (newDesc !== desc) {
                    this.setState({layoutUpdate: {title: newDesc}});
                }

                // selection change (selection is not supported for decimated data)
                if (data && data.rows && !data.decimateKey && newSelectInfo !== selectInfo) {
                    const selectedData = [];
                    if (newSelectInfo) {
                        const selectInfoCls = SelectInfo.newInstance(newSelectInfo, 0);
                        data.rows.forEach((arow) => {
                            if (selectInfoCls.isSelected(arow['rowIdx'])) {
                                selectedData.push(arow);
                            }
                        });
                    }
                    const selectedTraceIdx  = getTraceIdx(this.chartingInfo, SELECTED);
                    if (selectedTraceIdx >= 0) {
                        this.setState({
                            dataUpdateTraces: selectedTraceIdx,
                            dataUpdate: {
                                x: [selectedData.map((r) => r.x)],
                                y: [selectedData.map((r) => r.y)]
                            }
                        });
                    }
                }

                // highlight change
                if (!shallowequal(highlighted, newHighlighted) && !isUndefined(get(newHighlighted, 'rowIdx'))) {
                    const highlightedData = [];
                    if (!isUndefined(newHighlighted)) {
                        highlightedData.push(newHighlighted);
                    }
                    const highlightedTraceIdx  = getTraceIdx(this.chartingInfo, HIGHLIGHTED);
                    if (highlightedTraceIdx >= 0) {
                        this.setState({
                            dataUpdateTraces: highlightedTraceIdx,
                            dataUpdate: {
                                x: [highlightedData.map((r) => r.x)],
                                y: [highlightedData.map((r) => r.y)]
                            }
                        });
                    }
                }

                // plot parameters change
                if (params !== newParams) {
                    const updates = {};
                    //const xoptions = {};
                    //const yoptions = {};
                    const newXOptions = getXAxisOptions(newParams);
                    const newYOptions = getYAxisOptions(newParams);
                    const oldXOptions = getXAxisOptions(params);
                    const oldYOptions = getYAxisOptions(params);
                    if (!shallowequal(oldXOptions, newXOptions)) {
                        updates['xaxis.title'] = newXOptions.xTitle;
                        updates['xaxis.showgrid'] = newXOptions.xGrid;
                        updates['xaxis.side'] = newXOptions.xOpposite ? 'top' : 'bottom';
                        updates['xaxis.type'] = newXOptions.xLog ? 'log' : 'linear';
                        updates['margin.b'] = newXOptions.xOpposite ? MIN_MARGIN_PX : X_TICKLBL_PX;
                        updates['margin.t'] = newXOptions.xOpposite ? X_TICKLBL_PX : MIN_MARGIN_PX;
                    }
                    if (!shallowequal(oldYOptions, newYOptions)) {
                        updates['yaxis.title'] = newYOptions.yTitle;
                        updates['yaxis.showgrid'] = newYOptions.yGrid;
                        updates['yaxis.side'] = newYOptions.yOpposite ? 'right' : 'left';
                        updates['yaxis.type'] = newYOptions.yLog ? 'log' : 'linear';
                        updates['margin.l'] = newYOptions.yOpposite ? MIN_MARGIN_PX : Y_TICKLBL_PX;
                        updates['margin.r'] = newYOptions.yOpposite ? Y_TICKLBL_PX : MIN_MARGIN_PX;
                    }
                    if (!shallowequal(params.zoom, newParams.zoom) || !shallowequal(params.boundaries, newParams.boundaries) ||
                        oldXOptions.xReversed !== newXOptions.xReversed || oldYOptions.yReversed !== newYOptions.yReversed) {
                        const {xMin, xMax, yMin, yMax} = getZoomSelection(newParams);
                        const {xMin:xDataMin, xMax:xDataMax, yMin:yDataMin, yMax:yDataMax} = get(newParams, 'boundaries', {});
                        const xAxisMin = selFiniteMax(xMin, xDataMin);
                        const xAxisMax = selFiniteMin(xMax, xDataMax);
                        const yAxisMin = selFiniteMax(yMin,yDataMin);
                        const yAxisMax = selFiniteMin(yMax,yDataMax);
                        updates['xaxis.autorange'] = false;
                        updates['xaxis.range'] = getRange(xAxisMin, xAxisMax, newXOptions.xLog, newXOptions.xReversed); // no change for reverse here
                        updates['yaxis.range'] = getRange(yAxisMin, yAxisMax, newYOptions.yLog, newYOptions.yReversed); // no change for reverse here
                    }

                    if (!shallowequal(params.selection, newParams.selection)) {
                        if (newParams.selection) {
                            this.updateSelectionRect(newParams.selection, newXOptions.xLog, newYOptions.yLog);
                            return false;
                        } else {
                            updates['shapes'] = [];
                            updates['hovermode'] = 'closest'; // enable tooltips
                        }
                    }

                    if (Reflect.ownKeys(updates).length > 0) {
                        this.setState({
                            layoutUpdate: updates
                        });
                    }
                }

                // size change
                if (newWidth !== width || newHeight !== height ||
                    newParams.xyRatio !== params.xyRatio || newParams.stretch !== params.stretch) {
                    const {chartWidth, chartHeight} = calculateChartSize(newWidth, newHeight, nextProps);
                    this.setState({layoutUpdate: {height: chartHeight, width: chartWidth }});
                }
            }
        }
        return true;
    }

    shouldComponentUpdate(nextProps, nextState) {
        return sCompare(nextProps, nextState);
    }

    adjustYMargin(chart) {
        if (!chart) { return; }
        const ytickTexts = chart.querySelectorAll('g.ytick text');
        var maxYTickLen = MIN_MARGIN_PX;
        for (let i = 0, len=Math.abs(ytickTexts[i].clientWidth); i < ytickTexts.length; i++) {
            if (len > maxYTickLen) {
                maxYTickLen = len;
            }
        }
        const newMargin = maxYTickLen + MIN_YLBL_PX;

        const leftMargin = get(chart, ['layout', 'margin', 'l']);
        const rightMargin =  get(chart, ['layout', 'margin', 'r']);
        const oldMargin = Math.max (leftMargin, rightMargin);
        //when moving yAxis to the right, client width is sometimes huge
        if (newMargin < 200 && Math.abs(newMargin-oldMargin) > 2) {
            const layoutUpdate = leftMargin > rightMargin ?
                {'margin.l': newMargin} : {'margin.r': newMargin};
            this.setState({layoutUpdate});
        }
    }

    updateSelectionRect(selection, xLog, yLog) {

        if (this.selectionRect) {
            this.selectionRect.destroy();
            this.selectionRect = undefined;
        }
        if (selection) {
            const {xMin, xMax, yMin, yMax} = selection;
            const selColor = has(this.props, 'data.decimateKey') ? selectionRectColor : selectionRectColorGray;
            const layoutUpdate = {
                shapes: [{
                    layer: 'above',
                    type: 'rect',
                    xref: 'x',
                    yref: 'y',
                    x0: xLog ? Math.log10(xMin) : xMin,
                    y0: yLog ? Math.log10(yMin) : yMin,
                    x1: xLog ? Math.log10(xMax) : xMax,
                    y1: yLog ? Math.log10(yMax) : yMax,
                    fillcolor: selColor,
                    opacity: 0.5,
                    line: {
                        width: 0
                    }
                }],
                hovermode: false // disable tooltips
            };
            this.setState({layoutUpdate});
        }
    }

    onSelectionEvent(event) {
        const xAxis = event.xAxis[0];
        const yAxis = event.yAxis[0];

        if (xAxis && yAxis) {
            this.props.onSelection({xMin: xAxis.min, xMax: xAxis.max, yMin: yAxis.min, yMax: yAxis.max});
        }
    }


    /**
     * This method is called when new plotly chart is created
     * Because of plotly library is loaded asynchronously,
     * and restyle and relayout are called in promise,
     * whatever we usually do in componentDidMount should be done here,
     * whatever we usually do in componentDidUpdate, should be done
     * in plotly_relayout or plotly_restyle handler
     * @param chart
     * @param pl
     */
    afterRedraw(chart, pl) {

        const {params, highlighted, onHighlightChange, onSelection} = this.props;

        //adjustments
        if (params.selection) {
            this.updateSelectionRect(get(params, 'selection'), getXAxisOptions(params).xLog, getYAxisOptions(params).yLog);
        }
        this.adjustYMargin(chart);

        // handling tooltips in plotly_hover is very slow in Firefox
        // that's why we are pre-generating tooltips when creating data

        // handling highlight change
        var highlightedIdx = highlighted.rowIdx;
        if (onHighlightChange) {

            const rows = get(this.props, 'data.rows');
            const chartingInfo = this.chartingInfo;

            chart.on('plotly_click', (eventData) => {
                console.log(eventData);
                const curveNumber = eventData.points[0].curveNumber;
                const pointNumber = eventData.points[0].pointNumber;
                if (curveNumber === getTraceIdx(chartingInfo, DATAPOINTS)) {
                    const point = rows && rows[pointNumber];
                    if (point && point.rowIdx !== highlightedIdx) {
                        highlightedIdx = point.rowIdx;
                        onHighlightChange(highlightedIdx);
                    }
                } else if (curveNumber === getTraceIdx(chartingInfo, DATAPOINTS_HEATMAP)) {
                    // pointNumber is an array with y and x values
                    const [y,x] = pointNumber;
                    const key = `${x}:${y}`;
                    highlightedIdx = this.chartingInfo.toRowIdx.get(key);
                    if (!isUndefined(highlightedIdx)) {
                        onHighlightChange(highlightedIdx);
                    }
                }
            });
        }

        // handling selection (controls display of selection rectangle and selection options)
        if (onSelection) {
            chart.on('plotly_selected', (eventData) => {
                if (eventData && eventData.range) {
                    const [xMin, xMax] = eventData.range.x;
                    const [yMin, yMax] = eventData.range.y;
                    pl.d3.selectAll('.select-outline').remove();
                    onSelection({xMin, xMax, yMin, yMax});
                } else {
                    onSelection(null);
                }
            });
        }

        // whenever relayout occurs, adjust margin to accommodate tick length
        chart.on('plotly_relayout', () => {
            this.adjustYMargin(chart);
        });

    }

    render() {
        if (!this.chartingInfo) {
            this.chartingInfo = getChartingInfo(this.props);
        }
        const {plotlyData, plotlyLayout, plotlyDivStyle} = this.chartingInfo;
        const {dataUpdateTraces, dataUpdate, layoutUpdate} = this.state;

        return (
            <div style={{float: 'left'}}>
                <PlotlyWrapper data={plotlyData} layout={plotlyLayout}  style={plotlyDivStyle}
                               dataUpdateTraces={dataUpdateTraces}
                               dataUpdate={dataUpdate}
                               layoutUpdate={layoutUpdate}
                               config={PLOTLY_CONFIG}
                               newPlotCB={this.afterRedraw}
                />
            </div>
        );
    }
}

XYPlotPlotly.propTypes = {
    data: plotDataShape,
    width: PropTypes.number,
    height: PropTypes.number,
    params: plotParamsShape,
    highlighted: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number,
        rowIdx: PropTypes.number
    }),
    selectInfo: PropTypes.shape({
        selectAll: PropTypes.bool,
        exceptions: PropTypes.instanceOf(Set),
        rowCount: PropTypes.number
    }),
    onHighlightChange: PropTypes.func,
    onSelection: PropTypes.func,
    desc: PropTypes.string
};

XYPlotPlotly.defaultProps = {
    data: undefined,
    params: undefined,
    highlighted: undefined,
    onHighlightChange: undefined,
    onSelection: undefined,
    height: 300,
    desc: 'Sample XY Plot'
};

