/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get} from 'lodash';
import Enum from 'enum';

import {flux} from '../../Firefly.js';
import {BACKGROUND_PATH} from './BackgroundCntlr.js';
import {parseUrl} from '../../util/WebUtil.js';


/**
 * returns the whole background info object
 * @returns {BackgroundInfo}
 */
export function getBackgroundInfo() {
    return get(flux.getState(), [BACKGROUND_PATH], {});
}

/**
 * returns an array of all background jobs.
 * @returns [string]
 */
export function getBackgroundJobs() {
    return get(flux.getState(), [BACKGROUND_PATH, 'jobs']);
}

/**
 * returns the email used for background status notification.
 * @returns {string}
 */
export function getBgEmail() {
    return get(flux.getState(), [BACKGROUND_PATH, 'email']);
}


export function emailSent(bgStatus) {
    return get(bgStatus, 'ATTRIBUTES', '').includes('EmailSent');
}

export function canCreateScript(bgStatus) {
    return get(bgStatus, 'ATTRIBUTES', '').includes('DownloadScript');
}

export function isDone(state) {
    return BG_STATE.get('USER_ABORTED | CANCELED | FAIL | SUCCESS | UNKNOWN_PACKAGE_ID').has(state);
}

export function isFail(state) {
    return BG_STATE.get('FAIL | USER_ABORTED | UNKNOWN_PACKAGE_ID | CANCELED').has(state);
}

export function isSuccess(state) {
    return BG_STATE.SUCCESS.is(state);
}

export function isActive(state) {
    return BG_STATE.get('WAITING | WORKING | STARTING').has(state);
}


export const SCRIPT_ATTRIB = new Enum(['URLsOnly', 'Unzip', 'Ditto', 'Curl', 'Wget', 'RemoveZip']);
export const BG_STATE  = new Enum([
    /**
     * WAITING - Waiting to start request
     */
    'WAITING',
    /**
     * STARTING - Starting to package - used only on client side, before getting first status
     */
    'STARTING',
    /**
     * server is working on the packaging
     */
    'WORKING',
    /**
     * server is notifying of more data
     */
    'NEW_DATA',
    /**
     * USER_ABORTED - user aborted the package - should only be set on client side
     */
    'USER_ABORTED',
    /**
     * FAIL - server failed to package request
     */
    'FAIL',
    /**
     * SUCCESS - server successfully packaged request
     */
    'SUCCESS',
    /**
     * CANCELED - packaging was canceled, set by server when checking the canceled flag
     */
    'CANCELED',
    /**
     * UNKNOWN_PACKAGE_ID - a status used for a request with a unknown package id
     */
    'UNKNOWN_PACKAGE_ID'
]);