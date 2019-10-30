/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {isString, isObject} from 'lodash';
import {TABLE_LOADED, TABLE_SELECT,TABLE_HIGHLIGHT,TABLE_REMOVE,TABLE_UPDATE,TBL_RESULTS_ACTIVE} from '../../tables/TablesCntlr.js';
import {visRoot, dispatchRecenter} from '../ImagePlotCntlr.js';
import {getTblById, getCellValue} from '../../tables/TableUtil.js';
import Point, {makeWorldPt, makeAnyPt} from '../Point.js';
import {findTableCenterColumns} from '../../util/VOAnalyzer.js';
import {
    getActivePlotView,
    hasWCSProjection,
    isFullyOnScreen,
    primePlot, willFitOnScreenAtCurrentZoom
} from '../PlotViewUtil';
import {toDegrees} from '../VisUtil';
import {CysConverter} from '../CsysConverter';
import {dispatchPlotImage, dispatchUseTableAutoScroll} from '../ImagePlotCntlr';
import {isColRadians} from '../../tables/TableUtil';
import {PlotAttribute} from '../PlotAttribute';
import {isImage} from '../WebPlot';
import {getAppOptions} from '../../core/AppDataCntlr';
import CoordinateSys from '../CoordSys';





/** type {TableWatcherDef} */
export const activeRowCenterDef = {
    id : 'ActiveRowCenter',
    watcher : recenterImages,
    testTable : (table) => {
        return Boolean(findTableCenterColumns(table));
    },
    allowMultiples: false,
    actions: [TABLE_LOADED, TABLE_SELECT, TABLE_HIGHLIGHT, TABLE_UPDATE, TBL_RESULTS_ACTIVE, TABLE_REMOVE]
};

export function recenterImages(tbl_id, action, cancelSelf, params) {

    if (!action) return;

    const {imageScrollsToActiveTableOnLoadOrSelect}= getAppOptions();
    const {payload}= action;
    if (payload.tbl_id && payload.tbl_id!==tbl_id) return params;

    switch (action.type) {
        case TABLE_LOADED:
            recenterImageActiveRow(tbl_id, imageScrollsToActiveTableOnLoadOrSelect);
            break;

        case TABLE_SELECT:
            recenterImageActiveRow(tbl_id);
            break;

        case TABLE_HIGHLIGHT:
        case TABLE_UPDATE:
            recenterImageActiveRow(tbl_id);
            break;

        case TABLE_REMOVE:
            cancelSelf();
            break;

        case TBL_RESULTS_ACTIVE:
            recenterImageActiveRow(tbl_id, imageScrollsToActiveTableOnLoadOrSelect);
            break;

    }
}

const isImageAitoff= (plot) => (isImage(plot) && plot.projection.isWrappingProjection());

/**
 * return true if the point is not one the display
 * @param pv
 * @param wp
 * @param {boolean} force
 * @return {boolean}
 */
function shouldRecenterSimple(pv,wp, force) {
    const plot= primePlot(pv);
    if (force) {
        if (!isImageAitoff(plot)) return true; // if not an image aitoff projection
        return !(isFullyOnScreen(pv));
    }
    if (!plot) return false;
    const cc= CysConverter.make(plot);
    return !cc.pointOnDisplay(wp);
}


/**
 *
 * @param tbl_id the table id
 * @param force force a recenter under all cases
 */
function recenterImageActiveRow(tbl_id, force=false) {

    const vr= visRoot();
    if (!force && !vr.autoScrollToHighlightedTableRow) return;
    if (!vr.useAutoScrollToHighlightedTableRow) {
        dispatchUseTableAutoScroll(true);
        return;
    }
    const tbl= getTblById(tbl_id);
    const pv = getActivePlotView(visRoot());
    const plot = primePlot(pv);

    if (!plot || !hasWCSProjection(plot)) return;
    const wp= getRowCenterWorldPt(tbl);
    if (!wp) return;

    if (shouldRecenterSimple(pv,wp,force)) {
        isImageAitoff(plot) && willFitOnScreenAtCurrentZoom(pv) ?
            dispatchRecenter({plotId: plot.plotId, centerOnImage:true}) : dispatchRecenter({plotId: plot.plotId, centerPt: wp});
        if (plot && isImage(plot) && plot.attributes[PlotAttribute.REPLOT_WITH_NEW_CENTER]) {
            if (plot.projection.isWrappingProjection()) return; // it is all sky, don't do anything
            const r= pv.request.makeCopy();
            r.setWorldPt(wp);
            r.setPlotId(pv.plotId);
            dispatchPlotImage({plotId:pv.plotId, wpRequest:r, hipsImageConversion:pv.plotViewCtx.hipsImageConversion,
                        attributes:plot.attributes});
        }


    }
}

/**
 *
 * @param {TableModel|String} tableOrId
 * @return {WorldPt|Point|undefined}
 */
export function getRowCenterWorldPt(tableOrId) {
    const tbl=  getTableModel(tableOrId);
    if (!tbl) return;
    const cenCol= findTableCenterColumns(tbl);
    if (!cenCol) return;
    const {lonCol,latCol,csys}= cenCol;
    const lon= Number(getCellValue(tbl,tbl.highlightedRow, lonCol));
    const lat= Number(getCellValue(tbl,tbl.highlightedRow, latCol));

    const tmpPt= makeAnyPt(lon,lat,csys||CoordinateSys.EQ_J2000);
    if (tmpPt.type!==Point.W_PT) return tmpPt;
    return makeWorldPt(isColRadians(tbl,lonCol)? toDegrees(lon) : lon, isColRadians(tbl,latCol)? toDegrees(lat): lat, csys);
}

function getTableModel(tableOrId) {
    if (isString(tableOrId)) return getTblById(tableOrId);  // was passed a table Id
    if (isObject(tableOrId)) return tableOrId;
    return undefined;
}
