/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import React, {Component, PropTypes} from 'react';
import shallowequal from 'shallowequal';
import {get, pick} from 'lodash';

import {getDropDownInfo} from '../core/LayoutCntlr.js';
import {flux, getVersion} from '../Firefly.js';
import {SearchPanel} from '../ui/SearchPanel.jsx';
import {TestQueriesPanel} from '../ui/TestQueriesPanel.jsx';
import {ImageSelectDropdown} from '../ui/ImageSelectDropdown.jsx';

import './DropDownContainer.css';
// import {deepDiff} from '../util/WebUtil.js';


const dropDownMap = {
    AnyDataSetSearch: <SearchPanel />,
    TestSearches: <TestQueriesPanel />,
    ImageSelectDropDownCmd: <ImageSelectDropdown />
};




/**
 * The container for items appearing in the drop down panel.
 * This container mimic a card layout in which it will accept multiple cards.
 * However, only one selected card will be displayed at a time.
 * Items in this container must have a 'name' property.  It will be used to
 * compare to the selected card.
 */
export class DropDownContainer extends Component {
    constructor(props) {
        super(props);

        React.Children.forEach(this.props.children, (el) => {
            const key = get(el, 'props.name');
            if (key) dropDownMap[key] = el;
        });

        if (props.searchPanels) {
            props.searchPanels.forEach( (el) => {
                const key = get(el, 'props.name');
                if (key) dropDownMap[key] = el;
            } );
        }

        this.state = {
                visible: props.visible,
                selected: props.selected,
                searches: props.searches
            };
    }

    componentDidMount() {
        this.removeListener= flux.addListener(() => this.storeUpdate());
    }

    componentWillUnmount() {
        this.removeListener && this.removeListener();
    }
    
    shouldComponentUpdate(nProps, nState) {
        const check = ['visible','selected'];
        return !shallowequal(pick(nState, check), pick(this.state, check));
   }

    // componentDidUpdate(prevProps, prevState) {
    //     deepDiff({props: prevProps, state: prevState},
    //         {props: this.props, state: this.state},
    //         this.constructor.name);
    // }

    storeUpdate() {
        const {visible, view} = getDropDownInfo();
        if (visible!==this.state.visible || view!==this.state.selected) {
            this.setState({visible, selected: view});
        }
    }

    render() {
        var { visible, selected }= this.state;
        var view = dropDownMap[selected];

        if (!visible) return <div/>;
        return (
            <div className='DD-ToolBar'>
                <div className='DD-ToolBar__content'>
                    {view}
                </div>

                <Footers />
            </div>
        );
    }
}

DropDownContainer.propTypes = {
    visible: PropTypes.bool,
    selected: PropTypes.string,
    searches: PropTypes.arrayOf(PropTypes.string),
    searchPanels: PropTypes.arrayOf(PropTypes.element)
};
DropDownContainer.defaultProps = {
    visible: false
};




 const Footers = (props) => {
    return (
        <div id='footer' className='DD-ToolBar__footer'>
            <div className='DD-ToolBar__footer--links'>
                <ul>
                    <li><a href='https://irsasupport.ipac.caltech.edu/' target='helpdesk'>Contact</a></li>
                    <li><a href='http://irsa.ipac.caltech.edu/privacy.html' target='privacy'>Privacy Policy</a></li>
                    <li><a href='http://irsa.ipac.caltech.edu/ack.html' target='ack'>Acknowledge IRSA</a></li>
                </ul>
            </div>
            <div className='DD-ToolBar__footer--icons'>
                <a href='http://www.ipac.caltech.edu/'
                   alt='Infrared Processing and Analysis Center' target='ipac'
                   title='Infrared Processing and Analysis Center'><img alt='Icon_ipac'
                                                                        src='images/footer/icon_ipac-white-78x60.png'/></a>
                <a href='http://www.caltech.edu/'
                   alt='California Institute of Technology'
                   target='caltech' title='California Institute of Technology'><img
                    alt='Icon_caltech' src='images/footer/icon_caltech-new.png'/></a>
                <a href='http://www.jpl.nasa.gov/' alt='Jet Propulsion Laboratory'
                   target='jpl' title='Jet Propulsion Laboratory'><img alt='Icon_jpl'
                                                                       src='images/footer/icon_jpl-white-91x60.png'/></a>
                <a href='http://www.nasa.gov/'
                   alt='National Aeronautics and Space Administration' target='nasa'
                   title='National Aeronautics and Space Administration'><img
                    alt='Icon_nasa' src='images/footer/icon_nasa-white-59x60.png'/></a>
            </div>
            <div className='DD-ToolBar__version'>
                {getVersion()}
            </div>
        </div>
    );
};

const Alerts = (props) => {
    return (
        <div id="region-alerts" aria-hidden="true" style="width: 100%; height: 100%; display: none;">
            <div align="left" style="width: 100%; height: 100%;"></div>
        </div>
    );
};
