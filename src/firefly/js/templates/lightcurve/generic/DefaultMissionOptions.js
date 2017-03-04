import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
import {get, has, isEmpty, set} from 'lodash';
import {FieldGroup} from '../../../ui/FieldGroup.jsx';
import {ValidationField} from '../../../ui/ValidationField.jsx';
import {SuggestBoxInputField} from '../../../ui/SuggestBoxInputField.jsx';
import {makeFileRequest} from '../../../tables/TableUtil.js';
import {getColumnIdx, getTblById, smartMerge} from '../../../tables/TableUtil.js';
import {sortInfoString} from '../../../tables/SortInfo.js';
import {ReadOnlyText, getTypeData} from '../LcUtil.jsx';
import {LC, getViewerGroupKey} from '../LcManager.js';
import {getMissionName, coordSysOptions} from '../LcConverterFactory.js';

const labelWidth = 90;


export class DefaultSettingBox extends Component {
    constructor(props) {
        super(props);
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }

    render() {
        var {generalEntries, missionEntries} = this.props;

        if (isEmpty(generalEntries) || isEmpty(missionEntries)) return false;

        const wrapperStyle = {margin: '3px 0'};
/*
        var allCommonEntries = Object.keys(generalEntries).map((key) =>
            <ValidationField key={key} fieldKey={key} wrapperStyle={wrapperStyle}
                             style={{width: 80}}/>
        );
*/
        const missionKeys = [LC.META_TIME_CNAME, LC.META_FLUX_CNAME];
        const missionUrl = [LC.META_URL_CNAME];
        const missionOtherKeys = [ LC.META_ERR_CNAME];
        const tblModel = getTblById(LC.RAW_TABLE);
        const topZ = 9999;

        var getList = (val, type) => {
            var colType =  (!type || (type === 'numeric')) ?
                            ['double', 'd', 'long', 'l', 'int', 'i', 'float',  'f'] : ['char', 'c', 's', 'str'];

            return get(tblModel, ['tableData', 'columns']).reduce((prev, col) => {
                if ((colType.includes(col.type)) &&
                    (!has(col, 'visibility') || get(col, 'visibility') !== 'hidden') &&
                    (col.name.startsWith(val))) {
                    prev.push(col.name);
                }
                return prev;
            }, []);
        };

        var missionInputs = missionKeys.map((key) =>
            <SuggestBoxInputField key={key} fieldKey={key} wrapperStyle={wrapperStyle} popupIndex={topZ}
                                  getSuggestions={(val) => getList(val)} />
        );

        var missionData = missionUrl.map((key) =>
            <SuggestBoxInputField key={key} fieldKey={key} wrapperStyle={wrapperStyle} popupIndex={topZ}
                                  getSuggestions={(val) => getList(val, 'char')} />
        );

        var missionOthers = missionOtherKeys.map((key) =>
            <ValidationField key={key} fieldKey={key} wrapperStyle={wrapperStyle}/>
        );

        var missionPosEntries = () => {
            var sKey = LC.META_COORD_SYS;

            var sysCol = (
                <SuggestBoxInputField key={sKey} fieldKey={sKey} wrapperStyle={wrapperStyle}
                                      getSuggestions={() =>get(missionEntries, coordSysOptions, [])} />
            );
            var xyCols = [LC.META_COORD_XNAME, LC.META_COORD_YNAME].map((key) =>
                <SuggestBoxInputField key={key} fieldKey={key} wrapperStyle={wrapperStyle} popupIndex={topZ}
                                      getSuggestions={(val) => getList(val)} />
            );

            return [sysCol, xyCols];
        };

        const groupKey = getViewerGroupKey(missionEntries);
        const converterId = get(missionEntries, LC.META_MISSION);

        return (
            <FieldGroup groupKey={groupKey}
                        reducerFunc={defaultOptionsReducer(missionEntries, generalEntries)} keepState={true}>
                <div style={{display: 'flex', flexDirection: 'column'}} >
                    <ReadOnlyText label='Mission:' content={getMissionName(converterId)}
                                  labelWidth={labelWidth} wrapperStyle={{margin: '3px 0 6px 0'}}/>
                    <div style={{display: 'flex'}}>
                        <div>
                            {missionInputs}
                            {missionData}
                            {missionOthers}
                        </div>
                        <div>
                            {missionPosEntries()}
                        </div>
                    </div>
                </div>
            </FieldGroup>
        );
    }
}

DefaultSettingBox.propTypes = {
    generalEntries: PropTypes.object,
    missionEntries: PropTypes.object
};


export const defaultOptionsReducer = (missionEntries, generalEntries) => {
    return (inFields, action) => {
        if (inFields) {
            return inFields;
        }

        // defValues used to keep the initial values for parameters in the field group of result page
        // time: time column
        // flux: flux column
        // timecols:  time column candidates
        // fluxcols:  flux column candidates
        // errorcolumm: error column
        // cutoutsize: image cutout size
        const defValues = {
            [LC.META_TIME_CNAME]: Object.assign(getTypeData(LC.META_TIME_CNAME, '',
                'Time column name',
                'Time Column:', labelWidth),
                {validator: null}),
            [LC.META_FLUX_CNAME]: Object.assign(getTypeData(LC.META_FLUX_CNAME, '',
                'Value column name',
                'Value Column:', labelWidth),
                {validator: null}),
            [LC.META_TIME_NAMES]: Object.assign(getTypeData(LC.META_TIME_NAMES, '',
                'Value column suggestion'),
                {validator: null}),
            [LC.META_FLUX_NAMES]: Object.assign(getTypeData(LC.META_FLUX_NAMES, '',
                'Value column suggestion'),
                {validator: null}),
            ['cutoutSize']: Object.assign(getTypeData('cutoutSize', '',
                'image cutout size',
                'Cutout Size (deg):', 100)),
            [LC.META_ERR_CNAME]: Object.assign(getTypeData(LC.META_ERR_CNAME, '',
                'flux error column name',
                'Error Column:', labelWidth)),
            [LC.META_URL_CNAME]: Object.assign(getTypeData(LC.META_URL_CNAME, '',
                'Image url column name',
                'Source Column:', labelWidth)),
            [LC.META_COORD_XNAME]: Object.assign(getTypeData(LC.META_COORD_XNAME, '',
                'Coordinate X column name',
                'X Column:', labelWidth)),
            [LC.META_COORD_YNAME]: Object.assign(getTypeData(LC.META_COORD_YNAME, '',
                'Coordinate Y column name',
                'Y Column:', labelWidth)),
            [LC.META_COORD_SYS]: Object.assign(getTypeData(LC.META_COORD_SYS, '',
                'Coordinate system',
                'Coord System:', labelWidth))
        };

        var   defV = Object.assign({}, defValues);
        const validators = getFieldValidators(missionEntries, getTblById(LC.RAW_TABLE));

        const missionKeys = [LC.META_TIME_CNAME, LC.META_FLUX_CNAME, LC.META_URL_CNAME, LC.META_ERR_CNAME,
                             LC.META_COORD_XNAME, LC.META_COORD_YNAME, LC.META_COORD_SYS];
        const missionListKeys = [LC.META_TIME_NAMES, LC.META_FLUX_NAMES];

        missionListKeys.forEach((key) => {
            set(defV, [key, 'value'], get(missionEntries, key, []));
        });

        // set value and validator
        missionKeys.forEach((key) => {
            set(defV, [key, 'value'], get(missionEntries, key, ''));
            if (has(validators, key)) {
                set(defV, [key, 'validator'], validators[key]);
            }
        });

        /*
        Object.keys(generalEntries).forEach((key) => {
            set(defV, [key, 'value'], get(generalEntries, key, ''));
        });
        */
        return defV;
    };
};



function getFieldValidators(missionEntries, rawTable) {
    const fldsWithValidators = [
        {key: LC.META_TIME_CNAME, vkey: LC.META_TIME_NAMES},
        {key: LC.META_FLUX_CNAME, vkey: LC.META_FLUX_NAMES},
        {key: LC.META_URL_CNAME},
        {key: LC.META_COORD_XNAME},
        {key: LC.META_COORD_YNAME},
        {key: LC.META_COORD_SYS, vkey: coordSysOptions}
        //{key: LC.META_ERR_CNAME, vkey: LC.META_ERR_NAMES} // error can have no value
        ];
    return fldsWithValidators.reduce((all, fld) => {
        all[fld.key] =
            (val) => {
                let retVal = {valid: true, message: ''};
                const cols = get(missionEntries, fld.vkey, []);
                if (cols.length === 0 && rawTable) {
                    if (getColumnIdx(rawTable, val) < 0) {
                        retVal = {valid: false, message: `${val} is not a valid column name`};
                    }
                } else if (!cols.includes(val)) {
                    retVal = {valid: false, message: `${val} is not a valid column name`};
                }
                return retVal;
            };
        return all;
    }, {});
}

const posColumnInfo = (posCoords) => {
    const posElement = [LC.META_COORD_XNAME, LC.META_COORD_YNAME, LC.META_COORD_SYS];
    var posInfo = posElement.reduce((prev, ele) => {
        prev[ele] = '';
        return prev;
    }, {});

    if (posCoords) {
        var s = posCoords.split(';');
        if (s && s.length === 3) {
            s.forEach((ele, idx) => posInfo[posElement[idx]] = ele);
        }
    }

    return posInfo;
};


export function defaultOnNewRawTable(rawTable, missionEntries, generalEntries, converterData, layoutInfo={}) {
    const metaInfo = rawTable && rawTable.tableMeta;
    var posInfo = posColumnInfo(get(metaInfo, LC.META_POS_COORD));

    const addtlEntries = {
        [LC.META_URL_CNAME]: get(metaInfo, LC.META_URL_CNAME, converterData.dataSource),
        [LC.META_COORD_XNAME]: get(posInfo, LC.META_COORD_XNAME),
        [LC.META_COORD_YNAME]: get(posInfo, LC.META_COORD_YNAME),
        [LC.META_COORD_SYS]: get(posInfo, LC.META_COORD_SYS),
        [coordSysOptions]: get(converterData, coordSysOptions)
    };
    missionEntries = Object.assign({}, missionEntries, addtlEntries);
    return {shouldContinue: false, newLayoutInfo: smartMerge(layoutInfo, {missionEntries, generalEntries})};
}

export function defaultRawTableRequest(converter, source) {
    const options = {
        tbl_id: LC.RAW_TABLE,
        sortInfo: sortInfoString('mjd'),   //TODO: tentative solution to get around 'ROWID' issue
        tblType: 'notACatalog',
        pageSize: LC.TABLE_PAGESIZE
    };
    return makeFileRequest('Input Data', source, null, options);

}

export function defaultOnFieldUpdate(fieldKey, value) {
    if ([LC.META_TIME_CNAME, LC.META_FLUX_CNAME, LC.META_ERR_CNAME, LC.META_URL_CNAME,
            LC.META_COORD_XNAME, LC.META_COORD_YNAME, LC.META_COORD_SYS].includes(fieldKey)) {
        return {[fieldKey] : value};
    }
}
