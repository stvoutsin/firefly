/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {logError} from '../util/WebUtil.js';
import ImagePlotCntlr, {ActionScope,IMAGE_PLOT_KEY} from './ImagePlotCntlr.js';
import {primePlot, getPlotViewById, operateOnOthersInGroup,getPlotStateAry} from './PlotViewUtil.js';
import {
    callCrop,
    callChangeColor,
    callRotateNorth,
    callRotateToAngle,
    callFlipImageOnY,
    callRecomputeStretch} from '../rpc/PlotServicesJson.js';
import WebPlotResult from './WebPlotResult.js';
import {RangeValues} from './RangeValues.js';
import {isPlotNorth} from './VisUtil.js';
import {RotateType} from './PlotState.js';
import {WebPlot} from './WebPlot.js';



//=======================================================================
//-------------------- Action Creators ----------------------------------
//=======================================================================

/**
 * color bar Action creator
 * @param rawAction
 * @return {Function}
 */
export function colorChangeActionCreator(rawAction) {
    return (dispatcher,getState) => {
        var store= getState()[IMAGE_PLOT_KEY];
        var {plotId,cbarId, actionScope}= rawAction.payload;
        actionScope= ActionScope.get(actionScope);
        var pv= getPlotViewById(store,plotId);
        if (!pv) return;


        if (!primePlot(pv).plotState.isThreeColor()) {
            doColorChange(dispatcher,store,plotId,cbarId);
        }
        operateOnOthersInGroup(store,pv, (pv) => {
            var p= primePlot(pv);
            if (p && !p.plotState.isThreeColor()) { // only do others that are not three color
                doColorChange(dispatcher,store,pv.plotId,cbarId);
            }
        });

    };

}


/**
 * color bar Action creator
 * @param rawAction
 * @return {Function}
 */
export function stretchChangeActionCreator(rawAction) {
    return (dispatcher,getState) => {
        var store= getState()[IMAGE_PLOT_KEY];
        var {plotId,stretchData,actionScope}= rawAction.payload;
        actionScope= ActionScope.get(actionScope);
        var pv= getPlotViewById(store,plotId);
        var plot= primePlot(pv);
        if (!plot || !pv || !stretchData) return;


        dispatcher( { type: ImagePlotCntlr.STRETCH_CHANGE_START, payload: {plotId} } );

        const threeColor= plot.plotState.isThreeColor();
        doStretch(dispatcher,store,plotId,stretchData);
        operateOnOthersInGroup(store,pv, (pv) => {
            var p= primePlot(pv);
            if (p && p.plotState.isThreeColor()===threeColor) { // only do others that are similar
                doStretch(dispatcher,store,pv.plotId,stretchData);
            }
        });
    };
}


/**
 * @param rawAction
 * @return {Function}
 */
export function rotateActionCreator(rawAction) {
    return (dispatcher,getState) => {
        var store= getState()[IMAGE_PLOT_KEY];
        var { plotId, angle, rotateType, newZoomLevel, actionScope }= rawAction.payload;
        actionScope= ActionScope.get(actionScope);
        rotateType= RotateType.get(rotateType);
        var plotView= getPlotViewById(store,plotId);
        if (!plotView || !rotateType) return;
        var p= primePlot(plotView);
        if (!p) return;

        var firstRotate= true;
        if (rotateType===RotateType.NORTH && isPlotNorth(p)) {
            firstRotate= false;
        }
        if (rotateType===RotateType.UNROTATE && !p.plotState.isRotated()) {
            firstRotate= false;
        }

        if (firstRotate) doRotate(dispatcher,plotView,rotateType,angle,newZoomLevel);

        if (actionScope===ActionScope.GROUP) {
            operateOnOthersInGroup(store,plotView, (pv) => {
                var plot= primePlot(pv);
                if (rotateType===RotateType.NORTH && isPlotNorth(plot)) return;
                if (rotateType===RotateType.UNROTATE && !plot.plotState.isRotated()) return;
                doRotate(dispatcher,pv,rotateType,angle,newZoomLevel);
            });
        }
    };
}


/**
 * @param rawAction
 * @return {Function}
 */
export function cropActionCreator(rawAction) {
    return (dispatcher,getState) => {
        var store= getState()[IMAGE_PLOT_KEY];
        var { plotId, imagePt1, imagePt2, cropMultiAll, actionScope }= rawAction.payload;
        actionScope= ActionScope.get(actionScope);
        var plotView= getPlotViewById(store,plotId);
        if (!plotView || !imagePt1 || !imagePt2) return;
        var p= primePlot(plotView);
        if (!p) return;

        doCrop(dispatcher,plotView,imagePt1, imagePt2, cropMultiAll);
    };
}



/**
 * @param rawAction
 * @param store
 * @return {Function}
 */
export function flipActionCreator(rawAction) {
    return (dispatcher,getState) => {
        var store= getState()[IMAGE_PLOT_KEY];
        var { plotId, isY,actionScope }= rawAction.payload;
        var plotView= getPlotViewById(store,plotId);
        if (!plotView) return;
        if (!isY) {
           console.log('flip: x axis is still a todo');
            return;
        }
        var p= primePlot(plotView);
        if (!p) return;

        doFlip(dispatcher,plotView,isY);
        operateOnOthersInGroup(store,plotView, (pv) =>
            doFlip(dispatcher,pv,isY));
    };
}





//=======================================================================
//-------------------- End Action Creators -----------------------------
//=======================================================================


/**
 *
 * @param dispatcher
 * @param pv plot view
 * @param imagePt1
 * @param imagePt2
 * @param cropMultiAll
 */
function doCrop(dispatcher,pv,imagePt1, imagePt2, cropMultiAll) {

    const makeSuccAction= (plotId, plotAry, overlayPlotViews) => ({
        type: ImagePlotCntlr.CROP,
        payload: {pvNewPlotInfoAry: [{plotId, plotAry, overlayPlotViews}]}
    });

    const makeFailAction= (plotId) => ({ type: ImagePlotCntlr.CROP_FAIL,
        payload: {plotId, message: 'Crop Failed', error: Error('crop: payload failed')}
    });

    dispatcher( { type: ImagePlotCntlr.CROP_START, payload: {plotId:pv.plotId, message:'Cropping...'} } );
    callCrop(getPlotStateAry(pv), imagePt1, imagePt2, cropMultiAll)
    .then( (wpResult) => processPlotReplace(dispatcher,wpResult,pv,makeSuccAction, makeFailAction))
        .catch ( (e) => { dispatcher(makeFailAction(pv.plotId) );
            logError(`plot error, rotate , plotId: ${pv.plotId}`, e);
        });
}


function doFlip(dispatcher,pv,isY) {

    if (!isY) {
        console.log('flip: x axis is still a todo');
        return;
    }

    var p;
    if (isY) {
        p= callFlipImageOnY(getPlotStateAry(pv));
    }
    else {
        console.log('flip: x axis is still a todo');
        return;
    }

    const makeSuccAction= (plotId, plotAry, overlayPlotViews) =>
        ({ type: ImagePlotCntlr.FLIP,
           payload: {pvNewPlotInfoAry: [{plotId, plotAry, overlayPlotViews}], isY}
        });

    const makeFailAction= (plotId) => ({ type: ImagePlotCntlr.FLIP_FAIL,
                              payload: {plotId, message: 'Flip Failed', error: Error('flip: payload failed')}
                            });

    dispatcher( { type: ImagePlotCntlr.FLIP_START, payload: {plotId:pv.plotId, message:'Flipping...'} } );
    p.then( (wpResult) => processPlotReplace(dispatcher,wpResult,pv,makeSuccAction, makeFailAction))
        .catch ( (e) => { dispatcher( makeFailAction(pv.plotId) );
            logError(`plot error, rotate , plotId: ${pv.plotId}`, e);
        });
}



function doStretch(dispatcher,store,plotId,stretchData) {

    var plot= primePlot(store,plotId);
    dispatcher( { type: ImagePlotCntlr.STRETCH_CHANGE_START, payload: {plotId, message:'Changing Stretch...'} } );
    callRecomputeStretch(plot.plotState,stretchData)
        .then( (wpResult) => processPlotUpdate(dispatcher,plotId,wpResult,
                                   ImagePlotCntlr.STRETCH_CHANGE, ImagePlotCntlr.STRETCH_CHANGE_FAIL) )
        .catch ( (e) => {
            dispatcher( { type: ImagePlotCntlr.STRETCH_CHANGE_FAIL, 
                          payload: {plotId, message: 'Stretch Failed', stretchData, error:e} } );
            logError(`plot error, stretch change, plotId: ${plot.plotId}`, e);
        });
}



function doColorChange(dispatcher,store,plotId,cbarId) {

    var plot= primePlot(store,plotId);
    dispatcher( { type: ImagePlotCntlr.COLOR_CHANGE_START, payload: {plotId, message:'Changing Color...'} } );
    callChangeColor(plot.plotState,cbarId)
        .then( (wpResult) => processPlotUpdate(dispatcher,plotId,wpResult,
                                      ImagePlotCntlr.COLOR_CHANGE, ImagePlotCntlr.COLOR_CHANGE_FAIL) )
        .catch ( (e) => {
            dispatcher( { type: ImagePlotCntlr.COLOR_CHANGE_FAIL, 
                          payload: {plotId, message: 'Color change Failed', cbarId, error:e} } );
            logError(`plot error, color change, plotId: ${plot.plotId}`, e);
        });
}

function doRotate(dispatcher,pv,rotateType,angle,newZoomLevel) {

    var p;

    dispatcher( { type: ImagePlotCntlr.ROTATE_START, payload: {plotId:pv.plotId, message:'Rotating...'} } );
    switch (rotateType) {
        case RotateType.NORTH:
            p= callRotateNorth(getPlotStateAry(pv),true,newZoomLevel);
            break;
        case RotateType.ANGLE:
            p= callRotateToAngle(getPlotStateAry(pv), true, angle, newZoomLevel);
            break;
        case RotateType.UNROTATE:
            p= callRotateToAngle(getPlotStateAry(pv), false, NaN, 0);
            break;
    }


    const makeSuccAction= (plotId, plotAry, overlayPlotViews) => ({
        type: ImagePlotCntlr.ROTATE,
        payload: {pvNewPlotInfoAry: [{plotId, plotAry, overlayPlotViews}], rotateType}
    });

    const makeFailAction= (plotId) => ({ type: ImagePlotCntlr.ROTATE_FAIL,
        payload: {plotId, message: 'Rotate Failed', error: Error('rotate: payload failed')}
    });

    p.then( (wpResult) => processPlotReplace(dispatcher,wpResult,pv,makeSuccAction, makeFailAction))
        .catch ( (e) => {
            dispatcher( makeFailAction(pv.plotId));
            logError(`plot error, rotate , plotId: ${pv.plotId}`, e);
        });
}


/**
 *
 * @param dispatcher
 * @param result
 * @param pv
 * @param makeSuccessAction
 * @param makeFailAction
 */
function processPlotReplace(dispatcher, result, pv, makeSuccessAction, makeFailAction) {
    var successSent = false;
    if (result.success) {
        var resultAry= getResultAry(result);

        if (resultAry[0].success) {
            var plotAry = resultAry[0].data[WebPlotResult.PLOT_CREATE].map((wpInit) => makePlot(wpInit, pv));
            if (plotAry.length===1 && pv.plots.length>1) {
                const newP= plotAry[0];
                plotAry= pv.plots.map( (p,idx) => idx===pv.primeIdx ? newP : p);
            }

            var overlayPlotViews = [];
            resultAry.forEach((r, i) => {
                if (i === 0) return;
                var plot = WebPlot.makeWebPlotData(pv.plotId, r.data[WebPlotResult.PLOT_CREATE], true);
                overlayPlotViews[i - 1] = {plot};
            });

            dispatcher( makeSuccessAction(pv.plotId, plotAry, overlayPlotViews));
            dispatcher({type: ImagePlotCntlr.ANY_REPLOT, payload: {plotIdAry: [pv.plotId]}});
            successSent = true;

        }
    }
    if (!successSent) dispatcher( makeFailAction(pv.plotId));
}

function getResultAry(result) {
    if (result.PlotCreate) {
        return [{success:true, data:{PlotCreate:result.PlotCreate}}];
    }
    else if (result[WebPlotResult.RESULT_ARY]) {
        return result[WebPlotResult.RESULT_ARY];
    }
    else {
        throw Error('Could not find PlotCreate data');
    }
}


function makePlot(wpInit,pv) {
    var plot= WebPlot.makeWebPlotData(pv.plotId, wpInit);
    plot.title= primePlot(pv).title;
    plot.attributes= primePlot(pv).attributes;
    return plot;
}

/**
 *
 * @param dispatcher
 * @param plotId
 * @param result
 * @param succActionType
 * @param failActionType
 */
function processPlotUpdate(dispatcher, plotId, result, succActionType, failActionType) {
    if (result.success) {
        dispatcher( {
            type: succActionType,
            payload: {
                plotId,
                primaryStateJson : result[WebPlotResult.PLOT_STATE],
                primaryTiles : result[WebPlotResult.PLOT_IMAGES]
            }});
        dispatcher( { type: ImagePlotCntlr.ANY_REPLOT, payload:{plotIdAry:[plotId]}} );
    }
    else {
        dispatcher( { type: failActionType,
            payload: {plotId, error:Error('payload failed: '+ failActionType)} } );
    }
}
