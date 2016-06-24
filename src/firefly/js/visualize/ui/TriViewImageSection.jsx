/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {PropTypes} from 'react';
import {ExpandedModeDisplay} from '../iv/ExpandedModeDisplay.jsx';
import {Tab, Tabs} from '../../ui/panel/TabPanel.jsx';
import {MultiViewStandardToolbar} from './MultiViewStandardToolbar.jsx';
import {ImageMetaDataToolbar} from './ImageMetaDataToolbar.jsx';
import {MultiImageViewer} from './MultiImageViewer.jsx';
import {watchImageMetaData} from '../saga/ImageMetaDataWatcher.js';
import {watchCoverage} from '../saga/CoverageWatcher.js';
import {dispatchAddSaga} from '../../core/MasterSaga.js';
import {LO_MODE, LO_VIEW, dispatchSetLayoutMode, dispatchUpdateLayoutInfo} from '../../core/LayoutCntlr.js';

export const FITS_VIEWER_ID = 'triViewImages';
export const META_VIEWER_ID = 'triViewImageMetaData';
export const COVERAGE_VIEWER_ID = 'TBD';


/**
 * This component works with ImageMetaDataWatch sega which should be launch during initialization
 * @param showCoverage
 * @param showFits
 * @param showMeta
 * @param imageExpandedMode if true, then imageExpandedMode overrides everything else
 * @param closeable expanded mode should have a close button
 * @return {XML}
 * @constructor
 */
export function TriViewImageSection({showCoverage=false, showFits=false, selectedTab='fits',
                                     showMeta=false, imageExpandedMode=false, closeable=true}) {
    
    if (imageExpandedMode) {
        return  ( <ExpandedModeDisplay
                        key='results-plots-expanded'
                        forceExpandedMode={true}
                        closeFunc={closeable ? closeExpanded : null}/>
                );
    }
    const onTabSelect = (idx, id) => dispatchUpdateLayoutInfo({images:{selectedTab:id}});


    // showCoverage= true; // todo - let the application control is coverage is visible

    if (showCoverage || showFits || showMeta) {
        return (
            <Tabs onTabSelect={onTabSelect} defaultSelected={selectedTab} useFlex={true}>
                { showFits &&
                    <Tab name='Fits Data' removable={false} id='fits'>
                        <MultiImageViewer viewerId= {FITS_VIEWER_ID}
                                          insideFlex={true}
                                          canReceiveNewPlots={true}
                                          canDelete={true}
                                          Toolbar={MultiViewStandardToolbar}/>
                    </Tab>
                }
                { showMeta &&
                    <Tab name='Image Meta Data' removable={false} id='meta'>
                        <MultiImageViewer viewerId= {META_VIEWER_ID}
                                          insideFlex={true}
                                          canReceiveNewPlots={false}
                                          canDelete={false}
                                          Toolbar={ImageMetaDataToolbar}/>
                    </Tab>
                }
                { showCoverage &&
                    <Tab name='Coverage' removable={false} id='coverage'>
                        <MultiImageViewer viewerId='coverageImages'
                                          insideFlex={true}
                                          canReceiveNewPlots={false}
                                          canDelete={false}
                                          Toolbar={MultiViewStandardToolbar}/>
                    </Tab>
                }
            </Tabs>
        );

    }
    else {
        return <div>todo</div>;
    }
}


function closeExpanded() {
    dispatchSetLayoutMode(LO_MODE.expanded, LO_VIEW.none);
}

export function launchImageMetaDataSega() {
    dispatchAddSaga(watchImageMetaData,{viewerId: META_VIEWER_ID});
    dispatchAddSaga(watchCoverage, {viewerId:'coverageImages'});
}

TriViewImageSection.propTypes= {
    showCoverage : PropTypes.bool,
    showFits : PropTypes.bool,
    showMeta : PropTypes.bool,
    imageExpandedMode : PropTypes.bool,
    closeable: PropTypes.bool,
    selectedTab: PropTypes.oneOf(['fits', 'meta', 'coverage'])
};