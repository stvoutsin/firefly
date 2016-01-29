
/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 * Lijun
 *   1/16/2016
 *   propType: define all the property variable for the component
 *   this.plot, this.plotSate are the class global variables
 *
 */
import React from 'react';
import {makeScreenPt,makeImagePt,makeWorldPt} from '../Point.js';
import MouseState from '../VisMouseCntlr.js';
import {makeImageFromTile,createImageUrl,isTileVisible} from './../iv/TileDrawHelper.jsx';
import {isBlankImage} from '../WebPlot.js';
import InputFieldLabel from '../../ui/InputFieldLabel.jsx';
import {showMouseReadoutOptionDialog} from './MouseReadoutOptionDialog.jsx';
import CoordinateSys from '../CoordSys.js';
import CysConverter from '../CsysConverter.js';
import CoordUtil from '../CoordUtil.js';

var rS= {
	border: '1px solid white',
	width: 500,
	height: 32,
	display: 'inline-block',
	position: 'relative',
	verticalAlign: 'top'
};

const mrMouse= [ MouseState.ENTER,MouseState.EXIT, MouseState.MOVE, MouseState.DOWN , MouseState.CLICK];
const EMPTY= <div style={rS}></div>;
export function MouseReadout({plotView:pv,size,mouseState}) {

	if (!pv || !mouseState) return EMPTY;

	var plot= pv.primaryPlot;

	var leftColumn = {width: 200, display: 'inline-block'};

	var rightColumn = {display: 'inline-block'};
	var  textStyle = {textDecoration: 'underline', color: 'DarkGray', fontStyle:'italic' ,  display: 'inline-block'};
	return (
			<div style={ rS}>
               <div>

				 <div	style={leftColumn} onClick={ () => showDialog('pixelSize')}>
					 <div style={ textStyle} > { updateField('pixelSize')}</div>
				 </div>

				 <div   style={rightColumn} onClick={ () => showDialog('coordinateSys' )}>
					 <div style={ textStyle} >{ updateField('coordinateSys')} </div>
					 {showReadout(plot, mouseState, CoordinateSys.EQ_J2000)}</div>

              </div>
	         <div>
				 <div	style={leftColumn} > {showReadout(plot, mouseState) } </div>

				 <div style={ rightColumn}  onClick={ () => showDialog('imagePixel' )}>
					 <div style={ textStyle} >{updateField('imagePixel' )} </div>
					 {showReadout(plot, mouseState, CoordinateSys.PIXEL)}
				 </div>
		    </div>

		  </div>

	);
}

function showReadout(plot, mouseState, coordinate){
	if (!plot) return false;
	if (isBlankImage(plot)) return false;
	var cc= CysConverter.make(plot);
	var wpt= cc.getWorldCoords(mouseState.imagePt);
	var spt= mouseState.screenPt;

	var result;
	var lon = wpt.getLon();
	var lat = wpt.getLat();
    if (coordinate){

		switch (coordinate){
			case CoordinateSys.EQ_J2000:
				var hmsRa = CoordUtil.convertLonToString(lon, wpt.getCoordSys());
				var hmsDec = CoordUtil.convertLatToString(lat, wpt.getCoordSys());
				result = ' '+ hmsRa +' ' + hmsDec;
				break;
			case CoordinateSys.GALACTIC || CoordinateSys.SUPERGALACTIC:
				result=  ' '+lon + ' '+ lat;
				break;
			case CoordinateSys.PIXEL:
				//result = mouseState.pixelX + ' ' +  mouseState.pixelY;
				result = ' '+spt.x + ' ' + spt.y;
				break;
		}

	}
	else {
		//TODO readout for pixel size
	}
    return result;
}
function showDialog(fieldKey) {

		console.log('showing ' + fieldKey+ ' option dialog');
	   showMouseReadoutOptionDialog(fieldKey);

}
function updateField(fieldKey){
	if (fieldKey==='pixelSize'){
		return 'Pixel Size:';
	}
	else  if (fieldKey==='coordinateSys'){
		return 'EQ-J2000:';
	}
	else {
		return 'Image Pixel:';;
	}
}
MouseReadout.propTypes= {
	plotView: React.PropTypes.object,
	size: React.PropTypes.number.isRequired,
	mouseState: React.PropTypes.object
};
