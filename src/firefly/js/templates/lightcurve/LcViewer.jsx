/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */


import React, {Component, PropTypes} from 'react';
import sCompare from 'react-addons-shallow-compare';
import {pickBy, get} from 'lodash';
import {flux, firefly} from '../../Firefly.js';
import {getMenu, isAppReady, dispatchSetMenu, dispatchOnAppReady} from '../../core/AppDataCntlr.js';
import {getLayouInfo, SHOW_DROPDOWN} from '../../core/LayoutCntlr.js';
import {MetaConst} from '../../data/MetaConst.js';
import {lcManager, LC, removeTablesFromGroup, } from './LcManager.js';
import {getAllConverterIds, getConverter} from './LcConverterFactory.js';
import {listenerPanel} from './LcPhaseFoldingPanel.jsx';
import {LcResult} from './LcResult.jsx';
import {LcPeriod} from './LcPeriod.jsx';
import {Menu} from '../../ui/Menu.jsx';
import {Banner} from '../../ui/Banner.jsx';
import {DropDownContainer} from '../../ui/DropDownContainer.jsx';
import {VisHeader} from '../../visualize/ui/VisHeader.jsx';
import {getActionFromUrl} from '../../core/History.js';
import {dispatchAddSaga} from '../../core/MasterSaga.js';
import {FormPanel} from './../../ui/FormPanel.jsx';
import {FieldGroup} from '../../ui/FieldGroup.jsx';
import {FileUpload} from '../../ui/FileUpload.jsx';
import {ListBoxInputField} from '../../ui/ListBoxInputField.jsx';
import {dispatchHideDropDown} from '../../core/LayoutCntlr.js';
import {dispatchTableSearch} from '../../tables/TablesCntlr.js';
import {syncChartViewer} from '../../visualize/saga/ChartsSync.js';
import {makeFileRequest} from '../../tables/TableUtil.js';
import {sortInfoString} from '../../tables/SortInfo.js';


const vFileKey = LC.FG_FILE_FINDER;
/**
 * This is a light curve viewer.
 */
export class LcViewer extends Component {

    constructor(props) {
        super(props);
        this.state = this.getNextState();
        dispatchAddSaga(lcManager);
        dispatchAddSaga(listenerPanel);
        dispatchAddSaga(syncChartViewer);
    }

    getNextState() {
        const menu = getMenu();
        const layoutInfo = getLayouInfo();
        const isReady = isAppReady();

        return Object.assign({}, this.props,
            {menu, isReady, ...layoutInfo});
    }

    shouldComponentUpdate(np, ns) {
        return sCompare(this, np, ns);
    }

    componentDidMount() {
        this.iAmMounted = true;
        dispatchOnAppReady((state) => {
            onReady({state, menu: this.props.menu});
        });
        this.removeListener = flux.addListener(() => this.storeUpdate());
    }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    componentWillUnmount() {
        this.iAmMounted = false;
        this.removeListener && this.removeListener();
    }

    storeUpdate() {
        if (this.iAmMounted) {
            this.setState(this.getNextState());
        }
    }

    render() {
        var {isReady, menu={}, appTitle, appIcon, altAppIcon, dropDown,
                dropdownPanels=[], footer, style, displayMode, missionEntries} = this.state;
        const {visible, view} = dropDown || {};
        const periodProps = {displayMode, timeColName: get(missionEntries, [LC.META_TIME_CNAME]),
                                          fluxColName: get(missionEntries, [LC.META_FLUX_CNAME]),
                                          validTimeColumns: get(missionEntries, [LC.META_TIME_NAMES]),
                                          validFluxColumns: get(missionEntries, [LC.META_FLUX_NAMES])};

        dropdownPanels.push(<UploadPanel/>);

        if (!isReady) {
            return (<div style={{top: 0}} className='loading-mask'/>);
        } else {
            return (
                <div id='App' className='rootStyle' style={style}>
                    <header>
                        <BannerSection {...{menu, appTitle, appIcon, altAppIcon}}/>
                        <DropDownContainer
                            key='dropdown'
                            footer={footer}
                            visible={!!visible}
                            selected={view}
                            {...{dropdownPanels} } />
                    </header>
                    <main>
                        {displayMode&&displayMode.startsWith('period') ? <LcPeriod {...periodProps}/> : <LcResult/>}
                    </main>
                </div>
            );
        }
    }
}

/**
 * menu is an array of menu items {label, action, icon, desc, type}.
 * dropdownPanels is an array of additional react elements which are mapped to a menu item's action.
 * @type {{title: *, menu: *, appTitle: *, appIcon: *, altAppIcon: *, dropdownPanels: *, views: *}}
 */
LcViewer.propTypes = {
    title: PropTypes.string,
    menu: PropTypes.arrayOf(PropTypes.object),
    appTitle: PropTypes.string,
    appIcon: PropTypes.string,
    altAppIcon: PropTypes.string,
    footer: PropTypes.element,
    dropdownPanels: PropTypes.arrayOf(PropTypes.element),
    style: PropTypes.object,
    appTitle: PropTypes.string
};

LcViewer.defaultProps = {
    appTitle: 'Time Series Viewer'
};

function onReady({menu}) {
    if (menu) {
        dispatchSetMenu({menuItems: menu});
    }
    const {hasImages, hasTables, hasXyPlots} = getLayouInfo();
    if (!(hasImages || hasTables || hasXyPlots)) {
        const goto = getActionFromUrl() || {type: SHOW_DROPDOWN};
        if (goto) firefly.process(goto);
    }
}


function BannerSection(props) {
    const {menu, ...rest} = pickBy(props);
    return (
        <Banner key='banner'
            menu={<Menu menu={menu} /> }
            visPreview={<VisHeader showHeader={false}/> }
            readout={<VisHeader showPreview={false}/> }
            {...rest}
        />
    );
}

BannerSection.propTypes = {
    props: PropTypes.object
};


/**
 *  A generic upload panel.
 * @param {Object} props react component's props
 */
export function UploadPanel(props) {
    const wrapperStyle = {margin: '5px 0'};

    const options = getAllConverterIds().map((id) => { return {label: id, value: id}; });
    return (
        <div style={{padding: 10}}>
            <FormPanel
                groupKey={vFileKey}
                onSubmit={(request) => onSearchSubmit(request)}
                onCancel={dispatchHideDropDown}>
                <FieldGroup groupKey={vFileKey} validatorFunc={null} keepState={true}>
                    <FileUpload
                        wrapperStyle = {wrapperStyle}
                        fieldKey = 'rawTblSource'
                        initialState= {{
                            tooltip: 'Select a Light Curves Table file to upload',
                            label: 'Raw Light Curves Table:'
                        }}
                    />
                    <ListBoxInputField fieldKey='mission'
                        wrapperStyle = {wrapperStyle}
                        initialState= {{
                            value: 'wise',
                            tooltip: 'Enter the name of the mission',
                            label : 'Mission:',
                            labelWidth : 45
                        }}
                        options={options}
                    />
                </FieldGroup>
            </FormPanel>
        </div>
    );
}

UploadPanel.propTypes = {
    name: PropTypes.oneOf(['LCUpload'])
};

UploadPanel.defaultProps = {
    name: 'LCUpload'
};

function onSearchSubmit(request) {
    if ( request.rawTblSource ){
        removeTablesFromGroup();
        removeTablesFromGroup(LC.PERIODOGRAM_GROUP);

        const {mission} = request;
        const converter = getConverter(mission);
        if (!converter) return;

        const timeCName = converter.defaultTimeCName;
        const options = {
            tbl_id: LC.RAW_TABLE,
            tblType: 'notACatalog',
            sortInfo: sortInfoString(timeCName),
            META_INFO: {[MetaConst.DATASET_CONVERTER]: mission, timeCName},
            pageSize: LC.FULL_TABLE_SIZE
        };
        const treq = makeFileRequest('Raw Table', request.rawTblSource, null, options);
        dispatchTableSearch(treq, {removable: true});
        dispatchHideDropDown();
    } 
}
