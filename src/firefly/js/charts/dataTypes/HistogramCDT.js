/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get} from 'lodash';

import {doFetchTable, getTblById, isFullyLoaded, makeTblRequest, cloneRequest} from '../../tables/TableUtil.js';
import {getChartDataElement, chartDataUpdate} from './../ChartsCntlr.js';
import {logError} from '../../util/WebUtil.js';

export const DT_HISTOGRAM = 'histogram';

/**
 * Chart data type for histogram data
 * @constant
 * @type {ChartDataType}
 */
export const DATATYPE_HISTOGRAM = {
        id: DT_HISTOGRAM,
        fetchData: fetchColData,
        fetchParamsChanged: serverParamsChanged,
        fetchOnTblSort: false
};

/*
 Possible structure of store with histogram data:
 /data
   chartId: Object - the name of this node matches chart id
   {
      chartDataElements: [
        tblId
        isDataReady
        data: [[numInBin: int, min: double, max: double]*]
        meta: {tblSource}
        options: HistogramParams
      ]
   }
 */

/**
 * @global
 * @public
 * @typedef {Object} HistogramParams - histogram parameters
 * @prop {string} columnOrExpr - column or expression to use for histogram, can contain multiple column names ex. log(col) or (col1-col2)/col3
 * @prop {string} algorithm - 'fixedSizeBins' or 'bayesianBlocks'
 * @prop {number} [numBins] - number of bins for fixed bins algorithm (default)
 * @prop {number} [falsePositiveRate] false positive rate for bayesian blocks algorithm
 * @prop {string} [x]   comma separated list of x axis options: flip,log
 * @prop {string} [y]   comma separated list of y axis options: flip,log
 */

function serverParamsChanged(oldParams, newParams) {
    if (oldParams === newParams) { return false; }
    if (!oldParams || !newParams) { return true; }

    const newServerParams = getServerCallParameters(newParams);
    const oldServerParams = getServerCallParameters(oldParams);
    return newServerParams.some((p, i) => {
        return p !== oldServerParams[i];
    });
}

function getServerCallParameters(histogramParams) {
    if (!histogramParams) { return []; }
    return [
        histogramParams.columnOrExpr,
        histogramParams.x && histogramParams.x.includes('log'),
        histogramParams.numBins,
        histogramParams.falsePositiveRate
    ];
}


/**
 * Fetches histogram data.
 *
 * @param {Function} dispatch
 * @param {string} chartId  - chart id
 * @param {string} chartDataElementId - chart data element id
 */
function fetchColData(dispatch, chartId, chartDataElementId) {

    const chartDataElement = getChartDataElement(chartId, chartDataElementId);
    if (!chartDataElement) { logError(`[Histogram] Chart data element is not found: ${chartId}, ${chartDataElementId}` ); return; }

    const {tblId, options:histogramParams} = chartDataElement;

    if (!isFullyLoaded(tblId) || !histogramParams) {
        return;
    }

    const activeTableModel = getTblById(tblId);
    const activeTableServerRequest = activeTableModel['request'];
    const tblSource = get(activeTableModel, 'tableMeta.tblFilePath');

    const sreq = cloneRequest(activeTableServerRequest, {'startIdx' : 0, 'pageSize' : 1000000});

    const req = makeTblRequest('HistogramProcessor');
    req.searchRequest = JSON.stringify(sreq);

    // histogram parameters
    req.columnExpression = histogramParams.columnOrExpr;
    if (histogramParams.x && histogramParams.x.includes('log')) {
        req.columnExpression = 'log('+req.columnExpression+')';
    }
    if (histogramParams.numBins) { // fixed size bins
        req.numBins = histogramParams.numBins;
    }
    if (histogramParams.falsePositiveRate) {  // variable size bins using Bayesian Blocks
        req.falsePositiveRate = histogramParams.falsePositiveRate;
    }
    /*
    if (histogramParams.minCutoff) {
        req.min = histogramParams.minCutoff;
    }
    if (histogramParams.maxCutoff) {
        req.max = histogramParams.maxCutoff;
    }
    */

    req.tbl_id = 'histogram-'+chartId;

    doFetchTable(req).then(
        (tableModel) => {

            // make sure the data are coming from the latest search
            const currentChartDataElement = getChartDataElement(chartId, chartDataElementId);
            if (!currentChartDataElement || serverParamsChanged(histogramParams,currentChartDataElement.options)) {
                return;
            }

            let histogramData = [];
            if (tableModel.tableData && tableModel.tableData.data) {
                // if logarithmic values were requested, convert the returned exponents back
                var toNumber = histogramParams.x.includes('log') ?
                    (val,i)=>{
                        if (i === 0) {
                            return Number(val);
                        }
                        else {
                            return Math.pow(10,Number(val));
                        }
                    } : (val)=>Number(val);
                histogramData = tableModel.tableData.data.reduce((data, arow) => {
                    data.push(arow.map(toNumber));
                    return data;
                }, []);

            }
            dispatch(chartDataUpdate(
                {
                    chartId,
                    chartDataElementId,
                    isDataReady: true,
                    options : histogramParams,
                    data: histogramData,
                    meta: {tblSource}
                }));
        }
    ).catch(
        (reason) => {
            console.error(`Failed to fetch histogram data: ${reason}`);
        }
    );
}
