/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get, isEmpty} from 'lodash';
import Enum from 'enum';
import {flux} from '../Firefly.js';
import {clone} from '../util/WebUtil.js';
import {smartMerge} from '../tables/TableUtil.js';
import {getDropDownNames} from '../ui/Menu.jsx';

export const LAYOUT_PATH = 'layout';

// this enum is flaggable, therefore you can use any combination of the 3, i.e. 'tables | images'.
export const LO_VIEW = new Enum(['none', 'tables', 'images', 'xyPlots'], { ignoreCase: true });
export const LO_MODE = new Enum(['expanded', 'standard']);

/*---------------------------- Actions ----------------------------*/

export const SET_LAYOUT         = `${LAYOUT_PATH}.setLayout`;
export const SET_LAYOUT_MODE    = `${LAYOUT_PATH}.setLayoutMode`;
export const SHOW_DROPDOWN      = `${LAYOUT_PATH}.showDropDown`;

/*---------------------------- Reducers ----------------------------*/

export function reducer(state={}, action={}) {
    var {mode, view} = action.payload || {};

    switch (action.type) {
        case SET_LAYOUT :
            const dropDown = get(action, 'payload.dropDown');
            if( dropDown ) {
                action.payload.dropDown.view = getSelView(state, dropDown);
            }
            return smartMerge(state, action.payload);

        case SET_LAYOUT_MODE :
            return smartMerge(state, {mode: {[mode]: view}});

        case SHOW_DROPDOWN :
            var {visible = true} = action.payload;
            return smartMerge(state, {dropDown: {visible, view: getSelView(state, action.payload)}});

        default:
            return state;
    }

}

/*---------------------------- DISPATCHERS -----------------------------*/

/**
 * set the layout mode of the application.  see LO_MODE and LO_VIEW enums for options.
 * @param mode standard or expanded
 * @param view see LO_VIEW for options.
 */
export function dispatchSetLayoutMode(mode=LO_MODE.standard, view) {
    flux.process({type: SET_LAYOUT_MODE, payload: {mode, view}});
}

/**
 * set the layout info of the application.  data will be merged.
 * @param layoutInfo data to be updated
 */
export function dispatchUpdateLayoutInfo(layoutInfo) {
    flux.process({type: SET_LAYOUT, payload: {...layoutInfo}});
}

/**
 * show the drop down container
 * @param view name of the component to display in the drop-down container
 */
export function dispatchShowDropDown({view}={}) {
    flux.process({type: SHOW_DROPDOWN, payload: {visible: true, view}});
}

/**
 * hide the drop down container
 */
export function dispatchHideDropDown() {
    flux.process({type: SHOW_DROPDOWN, payload: {visible: false}});
}


/*------------------------- Util functions -------------------------*/
export function getExpandedMode() {
    return get(flux.getState(), ['layout','mode','expanded']);
}

export function getStandardMode() {
    return get(flux.getState(), ['layout','mode','standard']);
}

export function getDropDownInfo() {
    return get(flux.getState(), 'layout.dropDown', {visible: false});
}

export function getLayouInfo() {
    const layout = get(flux.getState(), 'layout', {});
    const hasImages = get(flux.getState(), 'allPlots.plotViewAry.length') > 0;
    const hasTables = !isEmpty(get(flux.getState(), 'table_space.results.main.tables', {}));
    const hasXyPlots = hasTables;
    return clone(layout, {hasImages, hasTables, hasXyPlots});
}

function getSelView(state, dropDown) {
    var {visible=true, view} = dropDown || {};
    if (visible && !view) {
        return get(state, 'layout.dropDown.view') || getDropDownNames()[0];
    }
    return view;
}

