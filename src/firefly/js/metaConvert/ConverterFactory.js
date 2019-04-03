/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */


import {get, isEmpty} from 'lodash';
import {makeWisePlotRequest} from './WiseRequestList.js';
import {make2MassPlotRequest} from './TwoMassRequestList.js';
import {makeAtlasPlotRequest} from './AtlasRequestList.js';
import {makeLsstSdssPlotRequest, makeLsstWisePlotRequest} from './LsstSdssRequestList.js';
import {WebPlotRequest, TitleOptions} from '../visualize/WebPlotRequest.js';
import {ZoomType} from '../visualize/ZoomType.js';
import {Band} from '../visualize/Band';
import {getCellValue} from '../tables/TableUtil.js';
import {makeWorldPt, parseWorldPt} from '../visualize/Point.js';
import {MetaConst} from '../data/MetaConst.js';
import {CoordinateSys} from '../visualize/CoordSys.js';
import {hasObsCoreLikeDataProducts} from '../util/VOAnalyzer.js';
import {dispatchUpdateCustom} from '../visualize/MultiViewCntlr.js';
import {makeObsCoreConverter, makeRequestForObsCore} from './ObsCoreConverter';


//const URL= 'URL';
const FILE= 'FILE';

function promiseWrap(makeReq) {
    return (table, row, includeSingle, includeStandard, threeColorOps) =>
             Promise.resolve( makeReq(table, row, includeSingle, includeStandard, threeColorOps));
}



export const converterTemplates = {
    'wise' : {
        threeColor : true,
        hasRelatedBands : true,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(makeWisePlotRequest),
        threeColorBands : {
            b1 : {color : Band.RED, title: 'Band 1'},
            b2 : {color : Band.GREEN, title: 'Band 2'},
            b3 : {color : null, title: 'Band 3'},
            b4 : {color : Band.BLUE, title: 'Band 4'}
        }
    },
    'atlas' : {
        hasRelatedBands : true,
        canGrid : true,
        maxPlots : 5,
        makeRequest : promiseWrap(makeAtlasPlotRequest)
    },
    'twomass' : {
        threeColor : true,
        hasRelatedBands : true,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(make2MassPlotRequest),
        threeColorBands : {
            J : {color : Band.RED, title: 'J'},
            H : {color : Band.GREEN, title: 'H'},
            K : {color : Band.BLUE, title: 'K'}
        }
    },
    'lsst_sdss' : {
        threeColor : true,
        hasRelatedBands : true,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(makeLsstSdssPlotRequest),
        threeColorBands : {
            u : {color : null, title: 'u'},
            g : {color : Band.RED, title: 'g'},
            r : {color : Band.GREEN, title: 'r'},
            i : {color : null,  title: 'i'},
            z : {color : Band.BLUE, title: 'z'}
        }
    },
    'lsst_wise' : {
        threeColor : true,
        hasRelatedBands : true,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(makeLsstWisePlotRequest),
        threeColorBands : {
            b1 : {color : Band.RED, title: 'Band 1'},
            b2 : {color : Band.GREEN, title: 'Band 2'},
            b3 : {color : null, title: 'Band 3'},
            b4 : {color : Band.BLUE, title: 'Band 4'}
        }
    },
    'ObsCore' : {
        threeColor : false,
        hasRelatedBands : false,
        canGrid : true,
        maxPlots : 12,
        makeRequest : makeRequestForObsCore
    },
    'UNKNOWN' : {
        threeColor : false,
        hasRelatedBands : false,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(makeRequestForUnknown)
    },
    'SimpleMoving' : {
        threeColor : false,
        hasRelatedBands : false,
        canGrid : true,
        maxPlots : 12,
        makeRequest : promiseWrap(makeRequestSimpleMoving)
    }
};


export function init3ColorDisplayManagement(viewerId) {
     const customEntry= Object.keys(converterTemplates).reduce( (newObj, key) => {
        if (!converterTemplates[key].threeColor) return newObj;
        newObj[key]= {...converterTemplates[key].threeColorBands, threeColorVisible:false};
        return newObj;
    }, {});
    dispatchUpdateCustom(viewerId, customEntry);
}


export function converterFactory(table) {
    const dataId= get(table, ['tableMeta', MetaConst.IMAGE_SOURCE_ID]) ||
                  get(table, ['tableMeta', MetaConst.DATASET_CONVERTER]);
    if (dataId) {
        return {converter:{...converterTemplates[dataId]},dataId};
    }
    else if (hasObsCoreLikeDataProducts(table)) {
        return {converter:makeObsCoreConverter(table,converterTemplates['ObsCore']),dataId:`ObsCore-${table.tbl_id}`};
    }
    else {
        return {converter:{...converterTemplates['UNKNOWN']},dataId:'UNKNOWN'};
    }
}


/**
 *  Support data the we don't know about
 * @param table
 * @param row
 * @param includeSingle
 * @param includeStandard
 * @return {{}}
 */
function makeRequestForUnknown(table, row, includeSingle, includeStandard) {

    const {tableMeta:meta}= table;

    const dataSource= findADataSourceColumn(meta,table.tableData.columns);
    if (!dataSource) return {};


    var positionWP= null;

    let sAry= meta[MetaConst.POSITION_COORD_COLS] && meta[MetaConst.POSITION_COORD_COLS].split(';');
    if (!sAry) sAry= meta[MetaConst.CENTER_COLUMN] && meta[MetaConst.CENTER_COLUMN].split(';');

    if (!isEmpty(sAry)) {
        const lon= Number(getCellValue(table,row,sAry[0]));
        const lat= Number(getCellValue(table,row,sAry[1]));
        const csys= CoordinateSys.parse(sAry[2]);
        positionWP= makeWorldPt(lon,lat,csys);
    }
    else if (meta[MetaConst.POSITION_COORD]) {
        positionWP= parseWorldPt(meta[MetaConst.POSITION_COORD]);
    }


    const retval= {};
    if (includeSingle) {
        retval.single= makeRequest(table,dataSource.name,positionWP, row);
    }
    
    if (includeStandard) {
        retval.standard= [makeRequest(table,dataSource.name,positionWP, row)];
        retval.highlightPlotId= retval.standard[0].getPlotId();
    }
    
    return retval;

}

function makeRequestSimpleMoving(table, row, includeSingle, includeStandard) {

    const {tableMeta:meta, tableData}= table;


    const dataSource= findADataSourceColumn(meta, tableData.columns);

    if (!dataSource) return {};


    const sAry= meta[MetaConst.POSITION_COORD_COLS].split(';');
    if (!sAry || sAry.length!== 3) return [];

    var positionWP= null;
    if (!isEmpty(sAry)) {
        const lon= Number(getCellValue(table,row,sAry[0]));
        const lat= Number(getCellValue(table,row,sAry[1]));
        const csys= CoordinateSys.parse(sAry[2]);
        positionWP= makeWorldPt(lon,lat,csys);
    }

    const retval= {};
    if (includeSingle) {
        retval.single= makeMovingRequest(table,row,dataSource.name,positionWP,'simple-moving-single-'+(row %24));
    }

    if (includeStandard) {
        retval.standard= [makeMovingRequest(table,row,dataSource.name,positionWP,'simple-moving-single')];
        retval.highlightPlotId= retval.standard[0].getPlotId();
    }

    return retval;

}


const defDataSourceGuesses= [ 'FILE', 'FITS', 'DATA', 'SOURCE', 'URL' ];
const dataSourceUpper= MetaConst.DATA_SOURCE.toUpperCase();

function findADataSourceColumn(meta,columns) {
    const dsCol= Object.keys(meta).find( (key) => key.toUpperCase()===dataSourceUpper);
    let guesses= meta[dsCol] ? [meta[dsCol],...defDataSourceGuesses] : defDataSourceGuesses;
    guesses= guesses.map( (g) => g.toUpperCase());
    return columns.find( (c) => guesses.includes(c.name.toUpperCase()));
}


/**
 *
 * @param table
 * @param row
 * @param dataSource
 * @param positionWP
 * @param plotId
 * @return {*}
 */
function makeMovingRequest(table, row, dataSource, positionWP, plotId) {
    const url= getCellValue(table,row,dataSource);
    const r = WebPlotRequest.makeURLPlotRequest(url, 'Fits Image');
    r.setTitleOptions(TitleOptions.FILE_NAME);
    r.setZoomType(ZoomType.TO_WIDTH_HEIGHT);
    r.setPlotId(plotId);
    r.setOverlayPosition(positionWP);
    return r;

}


/**
 *
 * @param table
 * @param dataSource
 * @param positionWP
 * @param row
 * @return {*}
 */
function makeRequest(table, dataSource, positionWP, row) {
    if (!table || !dataSource) return null;

    var r;
    var source= getCellValue(table, row, dataSource);
    if (dataSource.toLocaleUpperCase() === FILE) {
        r = WebPlotRequest.makeFilePlotRequest(source, 'Fits Image');
    }
    else {
        r = WebPlotRequest.makeURLPlotRequest(source, 'Fits Image');
    }
    r.setZoomType(ZoomType.FULL_SCREEN);
    r.setTitleOptions(TitleOptions.FILE_NAME);
    r.setPlotId(source);
    if (positionWP) r.setOverlayPosition(positionWP);

    return r;
}
