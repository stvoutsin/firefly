/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

/*globals ffgwt */
/*globals ffgwt.Visualize*/

import ImagePlotsActions from '../actions/ImagePlotsActions.js'
import {application} from '../core/Application.js';

class ImagePlotsStore {

    constructor() {
        //this.allPlots= ffgwt.Visualize.AllPlots.getInstance();
        this.bindListeners({
            handleAnyChange: ImagePlotsActions.anyChange,
        });
    }

    handleAnyChange(payload) {
    }
}

var imagePlotsStore= application.alt.createStore(ImagePlotsStore, 'ImagePlotsStore' );



export default imagePlotsStore;
