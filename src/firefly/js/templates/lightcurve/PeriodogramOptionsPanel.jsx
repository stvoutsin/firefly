/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
import './LCPanels.css';
import React, {Component, PropTypes} from 'react';
import {get,omit} from 'lodash';

import {FormPanel} from '../../ui/FormPanel.jsx';
import {FieldGroup} from '../../ui/FieldGroup.jsx';
import {InputGroup} from '../../ui/InputGroup.jsx';
import {InputField} from '../../ui/InputField.jsx';
import {dispatchHideDropDown} from '../../core/LayoutCntlr.js';
import {ListBoxInputField} from '../../ui/ListBoxInputField.jsx';
import {dispatchTableSearch} from '../../tables/TablesCntlr.js';
import FieldGroupUtils from '../../fieldGroup/FieldGroupUtils.js';
import {FieldGroupCollapsible} from '../../ui/panel/CollapsiblePanel.jsx';
import Validate from '../../util/Validate.js';
import {ValidationField} from '../../ui/ValidationField.jsx';
import {makeTblRequest,getTblById} from '../../tables/TableUtil.js';

import {loadXYPlot} from '../../charts/dataTypes/XYColsCDT.js';

import {dispatchMultiValueChange, dispatchRestoreDefaults} from '../../fieldGroup/FieldGroupCntlr.js';
import {RAW_TABLE,PERIODOGRAM, PEAK_TABLE} from '../../templates/lightcurve/LcManager.js';

const gkey = 'PFO_PANEL';
const options = [
    {label: 'Lomb‑Scargle ', value: 'ls', proj: 'LCViewer'},
    {label: 'Box-fitting Least Squares', value: 'bls', proj: 'LCViewer'},
    {label: 'Plavchan 2008', value: 'plav', proj: 'LCViewer'}

];
const stepoptions = [
    {label: 'Fixed Frequency', value: 'fixedf', proj: 'LCViewer'},
    {label: 'Fixed Period', value: 'fixedp', proj: 'LCViewer'},
    {label: 'Exponential', value: 'exp', proj: 'LCViewer'},
    {label: 'Plavchan', value: 'plav', proj: 'LCViewer'}

];


const defValues = {
    periodMin: {
        fieldKey: 'periodMin',
        //value: '1',
        forceReinit: true,
        validator: Validate.floatRange.bind(null, 10e-10, 1000000, 'periodMin field'),
        tooltip: 'this is a tip for low field',
        label: 'Minimum Period:',
        labelWidth: 150
    },
    periodMax: {
        fieldKey: 'periodMax',
        //value: '3',
        forceReinit: true,
        validator: Validate.floatRange.bind(null, 10e-10, 1000000, 'periodMax field'),
        tooltip: 'this is a tip for periodMax field',
        label: 'Maximum Period:',
        labelWidth: 150
    },
    x: {
        fieldKey: 'x',
        value: 'mjd',
        forceReinit: true,
        //validator: Validate.intRange.bind(null, 1, 100, 'periodMax field'),
        labelWidth: 150
    },
    y: {
        fieldKey: 'y',
        value: 'w1mpro_ep',
        forceReinit: true,
        //validator: Validate.intRange.bind(null, 1, 100, 'periodMax field'),
        labelWidth: 150
    },
    peaks: {
        fieldKey: 'peaks',
        value: '50',
        forceReinit: true,
        validator: Validate.intRange.bind(null, 1, 500, 'peaks number field'),
        labelWidth: 150
    },
    periodAlgor: {
        fieldKey: 'periodAlgor',
        value: 'ls',
        forceReinit: true,
        labelWidth: 150
    }

};

export class PeriodogramOptionsPanel extends Component {

    constructor(props) {
        super(props);
        this.state = {fields: FieldGroupUtils.getGroupFields(gkey)};
    }

    componentWillUnmount() {
        this.iAmMounted = false;
        if (this.unbinder) this.unbinder();
        //if (this.removeListener) this.removeListener();
        //this.iAmMounted= false;
    }

    componentDidMount() {
        this.iAmMounted = true;
        this.unbinder = FieldGroupUtils.bindToStore(gkey, (fields) => {
            if (fields !== this.state.fields && this.iAmMounted) {
                this.setState({fields});
            }
            //this.iAmMounted= true;
            //this.removeListener= FieldGroupUtils.bindToStore(gkey, (fields) => {
            //    if (this.iAmMounted) this.setState(fields);
        });
    }

    render() {
        var fields = this.state;
        return (
            <LcPeriodFindingPanel />
        );
    }


}

/**
 *
 * @returns {XML}
 * @constructor
 */
export function LcPeriodFindingPanel() {
    return (
        <div style={{padding:5}}>
            <FieldGroup groupKey={gkey} reducerFunc={periodogramRangeReducer} keepState={true}>
                <InputGroup labelWidth={150}>
                    <ListBoxInputField initialState={{
                              tooltip: 'Select Algorithm',
                              label : 'Algorithm:'
                       }}
                                       options={options }
                                       multiple={false}
                                       fieldKey='periodAlgor'
                    />
                    <br/>
                    <span> <b>Time: </b> </span>
                    <br/><br/>
                    <ValidationField fieldKey='x'
                                     tooltip='Enter Time column name'
                                     label='Time:'
                    />
                    <br/>
                    <span> <b>Flux: </b> </span>
                    <br/><br/>
                    <ValidationField fieldKey='y'
                                     tooltip='Enter Flux column name'
                                     label='Flux:'
                    />
                    <br/>
                    <span> <b>Period Range: </b> </span>
                    <br/><br/>
                    <ValidationField fieldKey='periodMin'/>
                    <br/>
                    <ValidationField fieldKey='periodMax'/>
                    <br/>
                    <span> <b>Period Step Method: </b></span>
                    <br/> <br/>
                    <ListBoxInputField initialState={{
                              tooltip: 'Period Step Method',
                              label : 'Select Method:'
                           }}
                                       options={stepoptions }
                                       multiple={false}
                                       fieldKey='stepMethod'
                    />
                    <br/>
                    <ValidationField fieldKey='stepSize'
                                     tooltip='Enter Step Size'
                                     label='Step Size:'
                    />
                    <br/>
                    <span> <b>Peaks: </b></span>
                    <br/> <br/>
                    <ValidationField fieldKey='peaks'
                                     tooltip='Enter Number of Peaks'
                                     label='Number of Peaks:'
                    />
                    <br/>
                    <button type='button' className='button std hl' onClick={(request) => onSearchSubmit(request)}>
                        <b>Period Finding</b>
                    </button>
                    <button type='button' className='button std hl' onClick={() => resetDefaults()}>
                        <b>Reset</b>
                    </button>

                </InputGroup>
            </FieldGroup>
            <br/>


        </div>

    );
};

/**
 *
 * @param {object} inFields
 * @param {object} action
 * @return {object}
 */
var periodogramRangeReducer = function (inFields, action) {
    if (!inFields) {
        return defValues;
    }
    else {
        var {periodMin,periodMax}= inFields;
        // inFields= revalidateFields(inFields);
        if (!periodMin.valid || !periodMax.valid) {
            return inFields;
        }
        if (parseFloat(periodMin.value) > parseFloat(periodMax.value)) {
            periodMin = Object.assign({}, periodMin, {
                valid: false,
                message: ' periodMin must be lower than periodMax'
            });
            periodMax = Object.assign({}, periodMax, {
                valid: false,
                message: 'periodMaxer must be higher than periodMin'
            });
            return Object.assign({}, inFields, {periodMin, periodMax});
        }
        else {
            periodMin = Object.assign({}, periodMin, periodMin.validator(periodMin.value));
            periodMax = Object.assign({}, periodMax, periodMax.validator(periodMax.value));
            return Object.assign({}, inFields, {periodMin, periodMax});
        }
    }
};


function onSearchSubmit(request) {
    console.log(request);
    //if (request.Tabs==='periodfinding') {
    doPeriodFinding(request);
    //}
    //else {
    //    console.log('request no supported');
    //}
}

function doPeriodFinding(request) {
    let tbl = getTblById(RAW_TABLE);
    //let catname0 = get(FieldGroupUtils.getGroupFields(gkey), 'cattable.value', catTable[0].value);
    const fields = FieldGroupUtils.getGroupFields(gkey);
    const srcFile = tbl.request.source;
    console.log(fields);

    var tReq2 = makeTblRequest('LightCurveProcessor', PEAK_TABLE, {
        'original_table': srcFile,
        'x': fields.x.value || 'mjd',
        'y': fields.y.value || 'w1mpro_ep',
        'alg': fields.periodAlgor.value,
        'pmin': fields.periodMin.value,
        'pmax': fields.periodMax.value,
        'step_method': fields.stepMethod.value,
        'step_size': fields.stepSize.value,
        'peaks': fields.peaks.value,
        //'result_table': 'http://web.ipac.caltech.edu/staff/ejoliet/demo/vo-nexsci-result-sample.xml', //For now return result table for non-existing API
        'table_name': PEAK_TABLE
    }, {tbl_id: PEAK_TABLE});

    if (tReq2 != null) {
        let xyPlotParams = {
            x: {columnOrExpr: 'Peak', options: 'grid'},
            y: {columnOrExpr: 'Power', options: 'grid'}
        };
        loadXYPlot({chartId: PEAK_TABLE, tblId: PEAK_TABLE, xyPlotParams});
        dispatchTableSearch(tReq2, {removable: true});
    }

    var tReq = makeTblRequest('LightCurveProcessor', PERIODOGRAM, {
        'original_table': srcFile,
        'x': fields.x.value || 'mjd',
        'y': fields.y.value || 'w1mpro_ep',
        'alg': fields.periodAlgor.value,
        'pmin': fields.periodMin.value,
        'pmax': fields.periodMax.value,
        'step_method': fields.stepMethod.value,
        'step_size': fields.stepSize.value,
        'peaks': fields.peaks.value,
        //'result_table': 'http://web.ipac.caltech.edu/staff/ejoliet/demo/vo-nexsci-result-sample.xml', //For now return result table for non-existing API
        'table_name': PERIODOGRAM
    }, {tbl_id: PERIODOGRAM});

    if (tReq != null) {
        dispatchTableSearch(tReq, {removable: true});
        let xyPlotParams = {
            userSetBoundaries: {yMin: 0},
            x: {columnOrExpr: 'Period', options: 'grid,log'},
            y: {columnOrExpr: 'Power', options: 'grid'}
        };
        loadXYPlot({chartId: PERIODOGRAM, tblId: PERIODOGRAM, markAsDefault: true, xyPlotParams});
    }
}

function resetDefaults() {
    dispatchRestoreDefaults(gkey);

}
