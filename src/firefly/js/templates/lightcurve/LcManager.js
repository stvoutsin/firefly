/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {isUndefined, get,isNil} from 'lodash';
import {take} from 'redux-saga/effects';

import {LO_VIEW, LO_MODE, SHOW_DROPDOWN, SET_LAYOUT_MODE, getLayouInfo, dispatchUpdateLayoutInfo, dropDownHandler} from '../../core/LayoutCntlr.js';
import {TBL_RESULTS_ADDED, TABLE_LOADED, TBL_RESULTS_ACTIVE, TABLE_HIGHLIGHT} from '../../tables/TablesCntlr.js';
import {getCellValue, getTblById, makeTblRequest} from '../../tables/TableUtil.js';
import {updateSet} from '../../util/WebUtil.js';
import {dispatchPlotImage, visRoot, dispatchDeletePlotView,
        dispatchChangeActivePlotView} from '../../visualize/ImagePlotCntlr.js';
import {getPlotViewById} from '../../visualize/PlotViewUtil.js';
import {getMultiViewRoot, dispatchReplaceViewerItems, getViewer} from '../../visualize/MultiViewCntlr.js';
import {WebPlotRequest} from '../../visualize/WebPlotRequest.js';
import {dispatchTableToIgnore} from '../../visualize/DrawLayerCntlr.js';
import Catlog from '../../drawingLayers/Catalog.js';
import {ServerRequest} from '../../data/ServerRequest.js';
import {CHANGE_VIEWER_LAYOUT} from '../../visualize/MultiViewCntlr.js';

export const RAW_TABLE = 'raw_table';
export const PHASE_FOLDED = 'phase_folded';
export const PERIODOGRAM = 'periodogram';
export const PEAK_TABLE = 'peak_table';
export const IMG_VIEWER_ID = 'lc_image_viewer';
export const DEF_IMAGE_CNT= 5;
export const MAX_IMAGE_CNT= 7;
const plotIdRoot= 'LC_FRAME-';

/**
 *  This event manager is custom made for light curve viewer.
 */
export function* lcManager() {

    while (true) {
        const action = yield take([
            TBL_RESULTS_ADDED, TABLE_LOADED, TBL_RESULTS_ACTIVE, TABLE_HIGHLIGHT, SHOW_DROPDOWN, SET_LAYOUT_MODE,
            CHANGE_VIEWER_LAYOUT
        ]);

        /**
         * This is the current state of the application.  Depending on what action is yielded, modify
         * this object accordingly then update it via dispatch.
         * @type {LayoutInfo}
         * @prop {boolean}  layoutInfo.showForm    show form panel
         * @prop {boolean}  layoutInfo.showTables  show tables panel
         * @prop {boolean}  layoutInfo.showCharts  show charts panel
         * @prop {boolean}  layoutInfo.showImages  show images panel
         * @prop {string}   layoutInfo.searchDesc  optional string describing search criteria used to generate this result.
         */
        var layoutInfo = getLayouInfo();
        var newLayoutInfo = layoutInfo;

        newLayoutInfo = dropDownHandler(newLayoutInfo, action);
        switch (action.type) {
            case TBL_RESULTS_ADDED:
            case TABLE_LOADED :
                newLayoutInfo = handleTableLoad(newLayoutInfo, action);
                break;
            case TABLE_HIGHLIGHT:
                handleTableHighlight(PHASE_FOLDED, action);
                break;
            case CHANGE_VIEWER_LAYOUT:
                handleChangeMultiViewLayout(PHASE_FOLDED);
                break;
            case TBL_RESULTS_ACTIVE :
                newLayoutInfo = handleTableActive(newLayoutInfo, action);
                break;
        }

        if (newLayoutInfo !== layoutInfo) {
            dispatchUpdateLayoutInfo(newLayoutInfo);

        }
    }
}


function handleTableLoad(layoutInfo, action) {
    const {tbl_id} = action.payload;
    layoutInfo =  updateSet(layoutInfo, 'showTables', true);
    if ( [RAW_TABLE, PEAK_TABLE, PHASE_FOLDED, PERIODOGRAM].includes(tbl_id) ) {
        layoutInfo = updateSet(layoutInfo, 'showXyPlots', true);
    }
    if ( [PHASE_FOLDED].includes(tbl_id) ){
        layoutInfo = updateSet(layoutInfo, 'showImages', true);
        handleTableHighlight(PHASE_FOLDED, action);
    }
    return layoutInfo;
}



function handleTableActive(layoutInfo, action) {
    return layoutInfo;
}

/**
 *
 * @param {string} activePhaseFoldedTableId last active phase folded table id
 * @param {Action} action
 */
function handleTableHighlight(activePhaseFoldedTableId, action) {
    const {tbl_id} = action.payload;
    if (tbl_id === activePhaseFoldedTableId) {
        try {
            setupImages(tbl_id);
        } catch (E){
            console.log(E.toString());
        }

    }
}

/**
 *
 * @param {string} activePhaseFoldedTableId last active phase folded table id
 */
function handleChangeMultiViewLayout(activePhaseFoldedTableId) {
    const tbl= getTblById(activePhaseFoldedTableId);
    if (get(tbl, 'totalRows',0)>0) setupImages(activePhaseFoldedTableId);
}

function getWebPlotRequest(tableModel, hlrow) {
    const ra = getCellValue(tableModel, hlrow, 'ra');
    const dec = getCellValue(tableModel, hlrow, 'dec');
    const frameId = getCellValue(tableModel, hlrow, 'frame_id');
    var   wise_sexp_ibe = /(\d+)([0-9][a-z])(\w+)/g;
    var   res = wise_sexp_ibe.exec(frameId);
    const scan_id = res[1] + res[2];
    const scangrp = res[2];
    const frame_num = res[3];

    const sr= new ServerRequest('ibe_file_retrieve');
    sr.setParam('mission', 'wise');
    sr.setParam('PROC_ID', 'ibe_file_retrieve');
    sr.setParam('ProductLevel',  '1b');
    sr.setParam('ImageSet', 'allsky-4band');
    sr.setParam('band', 2);
    sr.setParam('scangrp', `${scangrp}`);
    sr.setParam('scan_id', `${scan_id}`);
    sr.setParam('frame_num', `${frame_num}`);
    sr.setParam('center', `${ra},${dec}`);
    sr.setParam('size', '0.3');
    sr.setParam('subsize', '0.3');
    sr.setParam('in_ra',`${ra}`);
    sr.setParam('in_dec',`${dec}`);

    const reqParams = WebPlotRequest.makeProcessorRequest(sr, 'wise');
    reqParams.setTitle('WISE-'+ frameId);
    reqParams.setGroupLocked(true);
    reqParams.setPlotGroupId('LightCurveGroup');
    reqParams.setPreferenceColorKey('light-curve-color-pref');
    return reqParams;



}


function setupImages(tbl_id) {
    const viewer=  getViewer(getMultiViewRoot(),IMG_VIEWER_ID);
    const count= get(viewer, 'layoutDetail.count',DEF_IMAGE_CNT);
    const tableModel = getTblById(tbl_id);
    if (!tableModel || isNil(tableModel.highlightedRow)) return;
    var vr= visRoot();
    const newPlotIdAry= makePlotIds(tableModel.highlightedRow, tableModel.totalRows,count);
    const maxPlotIdAry= makePlotIds(tableModel.highlightedRow, tableModel.totalRows,MAX_IMAGE_CNT);


    newPlotIdAry.forEach( (plotId) => {
        if (!getPlotViewById(vr,plotId)) {
            const rowNum= Number(plotId.substring(plotIdRoot.length));
            const webPlotReq = getWebPlotRequest(tableModel,rowNum );
            dispatchPlotImage({plotId, wpRequest:webPlotReq,
                                       setNewPlotAsActive:false,
                                       holdWcsMatch:true,
                                       pvOptions: { userCanDeletePlots: false}});
        }
    });


    dispatchReplaceViewerItems(IMG_VIEWER_ID, newPlotIdAry);
    dispatchChangeActivePlotView(plotIdRoot+tableModel.highlightedRow);

    vr= visRoot();

    vr.plotViewAry
        .filter( (pv) => pv.plotId.startsWith(plotIdRoot))
        .filter( (pv) => pv.plotId!==vr.mpwWcsPrimId)
        .filter( (pv) => !maxPlotIdAry.includes(pv.plotId))
        .forEach( (pv) => dispatchDeletePlotView({plotId:pv.plotId, holdWcsMatch:true}));
}


function makePlotIds(highlightedRow, totalRows, totalPlots)  {
    const plotIds= [];
    const beforeCnt= totalPlots%2===0 ? totalPlots/2-1 : (totalPlots-1)/2;
    const afterCnt= totalPlots%2===0 ? totalPlots/2    : (totalPlots-1)/2;
    var j=0;
    var endRow= Math.min(totalRows-1, highlightedRow+afterCnt);
    var startRow= Math.max(0,highlightedRow-beforeCnt);
    if (startRow===0) endRow= Math.min(totalRows-1, totalPlots-1);
    if (endRow===totalRows-1) startRow= Math.max(0, totalRows-totalPlots);

    for(var i= startRow; i<=endRow; i++) plotIds[j++]= plotIdRoot+i;
    return plotIds;
}
