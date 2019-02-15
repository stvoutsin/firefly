/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

//-----------------
import PositionParser from '../util/PositionParser';
import PositionFieldDef from '../data/form/PositionFieldDef';
import {getRootPath} from '../util/BrowserUtil.js';
import {fetchUrl} from '../util/WebUtil.js';
import {parseWorldPt} from '../visualize/Point';


export {formatPosForTextField} from '../data/form/PositionFieldDef.js';


// return an object with:
//     feedback, string
//     inputType
//     valid, boolean
//     aborter function
//     wpt, WorldPt
//     showHelp, boolean
//     return parse results

function makeResolverPromise(objName/*, resolver*/) {
    let ignoreSearchResults= null;
    let aborted= false;

    const aborter= function() {
        aborted= true;
        if (ignoreSearchResults!==null) ignoreSearchResults();
    };

    const workerPromise= new Promise(
        function(resolve, reject) {
            setTimeout( ()=> {
                if (aborted) {
                    reject();
                }
                else {
                    const {p, rejectFunc}= makeSearchPromise(objName/*, resolver*/);
                    ignoreSearchResults= rejectFunc;
                    resolve(p);
                }
            }, 200);
        }
    );



    return {p:workerPromise, aborter};
}



function makeSearchPromise(objName) {
    let rejectFunc= null;
    const url= `${getRootPath()}sticky/CmdSrv?objName=${objName}&cmd=CmdResolveNaifid`;
    const searchPromise= new Promise(
        function(resolve, reject) {
            let fetchOptions = {};
            // AbortController might not be available in older browsers
            if (typeof AbortController !== 'undefined') {
                // fetch will be aborted after timeout
                const fetchTimeoutMs = 7000;
                const controller = new AbortController();
                const signal = controller.signal;
                setTimeout(() => {
                    controller.abort();
                }, fetchTimeoutMs);
                fetchOptions = {signal};
            }

            fetchUrl(url, fetchOptions).then( (response) => {
                response.json().then((value) => {
                    resolve(value);
                });
            }).catch( (error) => {
                return reject(error);
            });
        });

    const abortPromise= new Promise(function(resolve,reject) {
        rejectFunc= reject;
    });
    return {p:Promise.race([searchPromise,abortPromise]), rejectFunc};
}

export function resolveNaifidObj(object){
    let result = resolveObject(object);//makeResolverPromise(object);
    return result;
}


/*export function parseTarget(inStr, lastResults, resolver) {
    let wpt= null;
    let valid= false;
    const targetInput= inStr;
    let feedback= 'valid: false';
    let showHelp= true;
    const posFieldDef= PositionFieldDef.makePositionFieldDef();
    let resolveData= null;
    let resolvePromise= null;
    let aborter= null;
    let errMsg = null;

    if (targetInput) {
        if (lastResults && lastResults.aborter) lastResults.aborter();
        try {
            valid= posFieldDef.validateSoft(targetInput);
        } catch (e) {
            valid= false;
            errMsg = e;
        }

        if (valid) {
            wpt= posFieldDef.getPosition();
            if (posFieldDef.getInputType()===PositionParser.PositionParsedInput.Position) {
                showHelp= false;
                feedback= posFieldDef.formatPosForHelp(wpt);
            }
            else {
                if (posFieldDef.getObjectName()) {
                    showHelp= false;
                    feedback= `<i>Resolving:</i>  ${posFieldDef.getObjectName()}`;
                    resolveData= resolveObject(posFieldDef, resolver);
                }
                else {
                    showHelp= true;
                }
            }
        }
    }
    if (resolveData && resolveData.p && resolveData.aborter) {
        resolvePromise= resolveData.p;
        aborter= resolveData.aborter;
    }

    return {showHelp, feedback, parseError: errMsg,
        inputType: posFieldDef.getInputType(),
        valid, resolvePromise, wpt, aborter  };
}*/


/*export function getFeedback(wpt) {
    const posFieldDef= PositionFieldDef.makePositionFieldDef();
    return posFieldDef.formatTargetForHelp(wpt);
}*/

function resolveObject(objName/*posFieldDef, resolver*/) {
    //const objName= encodeURIComponent(posFieldDef.getObjectName());
    if (!objName) {
        return {
            showHelp: true,
            valid : true,
            feedback: ''
        };
    }

    var {p,aborter}= makeResolverPromise(objName/*, resolver*/);
    p= p.then( (results) =>
        {
            if (results) {
                if (results[0].success) {
                    return{
                        data: results[0].data,
                        showHelp: false,
                        valid: true,
                    };
                }
                else {
                    return {
                        showHelp: false,
                        feedback: `Could not resolve: ${objName}`,
                        valid: false
                    };
                }
            }
            else {
                return {
                    showHelp: false,
                    feedback: `Could not resolve: ${objName}`,
                    valid: false
                };
            }
        }
    ).catch((e) => {
        let feedback = `Could not resolve: ${objName}`;
        if (e.name === 'AbortError') {
            feedback += '. Unresponsive service.';
        } else {
            feedback += '. Unexpected error.';
            if (e) console.error(e);
        }
        return {
            showHelp: false,
            feedback,
            valid: false,
            wpt: null
        };
    });

    return {p};

}



