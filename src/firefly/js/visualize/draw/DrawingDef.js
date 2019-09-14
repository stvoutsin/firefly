/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {DrawSymbol} from './DrawSymbol.js';
import Enum from 'enum';


export const COLOR_SELECTED_PT = '#ffff00'; // yellow
export const COLOR_HIGHLIGHTED_PT = '#ff8000'; // orange
const COLOR_PT_1 = '#ff0000'; // red
const COLOR_PT_2 = '#00ff00'; //green
const COLOR_PT_3 = 'pink';  // pink
const COLOR_PT_4 = '#00a8ff'; //blue
const COLOR_PT_5 =  '#990099'; //purple
const COLOR_PT_6 = '#ff00FF'; //pinkish
const COLOR_PT_7 = '#00ffff'; //Aqua
const COLOR_PT_8 = '#800000'; //Maroon

const USED_COLORS= [COLOR_PT_1, COLOR_PT_2, COLOR_PT_3, COLOR_PT_5, COLOR_PT_6, COLOR_PT_7, COLOR_PT_8];

export const COLOR_DRAW_1 = '#ff0000'; // red
export const COLOR_DRAW_2 = '#5500ff'; // purple

/** 
 *  enum
 *  a very long enum, look at code in DrawingDef.js
 * */
export const TextLocation = new Enum([ 'DEFAULT',
    'LINE_TOP',
    'LINE_BOTTOM',
    'LINE_MID_POINT',
    'LINE_MID_POINT_OR_BOTTOM',
    'LINE_MID_POINT_OR_TOP',
    'LINE_TOP_STACK',
    'CIRCLE_NE',
    'CIRCLE_NW',
    'CIRCLE_SE',
    'CIRCLE_SW',
    'RECT_NE',
    'RECT_NW',
    'RECT_SE',
    'RECT_SW',
    'ELLIPSE_NE',
    'ELLIPSE_NW',
    'ELLIPSE_SE',
    'ELLIPSE_SW',
    'REGION_NE',
    'REGION_NW',
    'REGION_SE',
    'REGION_SW',
    'CENTER']); // use MID_X, MID_X_LONG, MID_Y, MID_Y_LONG for vertical or horizontal lines

export const Style= new Enum(['STANDARD','HANDLED', 'STARTHANDLED', 'ENDHANDLED', 'LIGHT', 'FILL']);

export const DEFAULT_FONT_SIZE = '9pt';


/**
 * @typedef {Object} DrawingDef
 *
 * The defaults that a drawing layer might use. Note that all the properties of this object are optional.
 * It can be created with any subset.
 *
 * @prop {String} color color css style
 * @prop {DrawSymbol} symbol default: DrawSymbol.X,
 * @prop {Number} lineWidth default:1,
 * @prop {Number} size  default: 4,
 * @prop {{shadow:number, rotAngle:number,translation:Object}} renderOptions
 * @prop {TextLocation} textLoc
 * @prop {String} fontName default: 'helvetica',
 * @prop {String} fontSize css size
 * @prop {String} fontWeight default: 'normal',
 * @prop {String} fontStyle default: 'normal',
 * @prop {String} selectedColor color css style
 * 
 */



/**
 * Object to hold defaults for drawing a group of objects.
 *
 * @param color
 * @param presetDefaults
 * @return {DrawingDef}
 */
export function makeDrawingDef(color= 'red', presetDefaults= {}) {

	// FIXME: those are not DS9 colors, hence problem when saved in DS9 regions format file


    const def= {
        color,
        symbol: DrawSymbol.X,
        lineWidth:1,
        size : 4,
        renderOptions: {shadow:null,rotAngle:null,translation:null},
        textLoc: TextLocation.DEFAULT,
        fontName: 'helvetica',
        fontSize:  DEFAULT_FONT_SIZE,
        fontWeight: 'normal',
        fontStyle: 'normal',
        selectedColor: COLOR_SELECTED_PT
    };
    return Object.assign({}, def, presetDefaults);
}

const colorList= USED_COLORS.map( (c) => ({count:0, name:c}));

export function getNextColor() {
    const nextColor= [...colorList].sort( (cO1, cO2) => cO1.count-cO2.count)[0];
    nextColor.count++;
    return nextColor.name;
}

export function releaseColor(cName) {
    const colorObj= colorList.find( (cO) => cO.name===cName);
    if (colorObj && colorObj.count>0) colorObj.count--;
}






