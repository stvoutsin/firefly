/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import PropTypes from 'prop-types';
import {flux} from '../core/ReduxFlux.js';
import {HELP_LOAD} from '../core/AppDataCntlr.js';

import largeHelp from 'html/images/icons-2014/Help.png';
import smallHelp from 'html/images/icons-2014/Help-16x16.png';

import './HelpIcon.css';

export function HelpIcon({helpId, size='small', style={}}) {
    var imgSrc = (size === 'small') ? smallHelp : largeHelp;

    var onClick = (e) => {
        e.stopPropagation();
        flux.process({
            type: HELP_LOAD,
            payload: {helpId}
        });
    };

    return (
        <div style={style}>
            <img className={'helpicon'}
                 onClick={onClick}
                 src={imgSrc}/>
        </div>);
}

HelpIcon.propTypes = {
    helpId: PropTypes.string,
    size:   PropTypes.oneOf(['small', 'large']),
    style: PropTypes.object
};


export default HelpIcon;
