/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React from 'react';
import CompleteButton from './CompleteButton.jsx';
import * as TablesCntlr from '../tables/TablesCntlr.js';



function handleFailfure() {

}

function createSuccessHandler(action, params, onSubmit) {

    return (request={}) => {
        if (action === TablesCntlr.TABLE_FETCH) {
            if (params) {
                request = Object.assign(request, params);
            }
            TablesCntlr.dispatchTableFetch(request);
        }
        if (onSubmit) {
            onSubmit(request);
        }
    };
}

var FormPanel = function (props) {
    var {children, onSubmit, onCancel, onError, groupKey, action, params, width, height} = props;

    const style = { width, height,
        backgroundColor: 'white',
        border: '1px solid rgba(0,0,0,0.3)',
        padding: 5,
        marginBottom: 5
    };
    return (
        <div>
            <div style={style}>
                {children}
            </div>
            <CompleteButton style={{display: 'inline-block', marginRight: 10}}
                            groupKey={groupKey}
                            onSuccess={createSuccessHandler(action, params, onSubmit)}
                            onFail={onError || handleFailfure}
                            text = 'Search'
            />
            <button style={{display: 'inline-block'}} type='button' className='button-std' onClick={onCancel}>Cancel</button>
        </div>
    );
};


FormPanel.propTypes = {
    onSubmit: React.PropTypes.func,
    onCancel: React.PropTypes.func,
    groupKey: React.PropTypes.string,
    action: React.PropTypes.string,
    params: React.PropTypes.object
};


export default FormPanel;