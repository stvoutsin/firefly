/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

import {get, has, isArray, isEmpty, isObject, isString, intersection} from 'lodash';
import Enum from 'enum';
import {getColumn, getColumnIdx, getColumnValues, getColumns, getTblById, getCellValue, getColumnByID} from '../tables/TableUtil.js';
import {getCornersColumns} from '../tables/TableInfoUtil.js';
import {MetaConst} from '../data/MetaConst.js';
import {CoordinateSys} from '../visualize/CoordSys.js';
import {makeWorldPt} from '../visualize/Point';
import {getBooleanMetaEntry, getMetaEntry} from '../tables/TableUtil';


export const UCDCoord = new Enum(['eq', 'ecliptic', 'galactic']);

const obsPrefix = 'obscore:';
const ColNameIdx = 0;
const UcdColIdx = 1;
const UtypeColIdx = 2;
const mainMeta = 'meta.main';
const obsCorePosColumns = ['s_ra', 's_dec'];
const obsCoreRegionColumn = 's_region';

const OBSTAPCOLUMNS = [
    ['dataproduct_type',  'meta.id',                    'ObsDataset.dataProductType'],
    ['calib_level',       'meta.code;obs.calib',        'ObsDataset.calibLevel'],
    ['obs_collection',    'meta.id',                    'DataID.collection'],
    ['obs_id',            'meta.id',                    'DataID.observationID'],
    ['obs_publisher_did', 'meta.ref.uri;meta.curation', 'Curation.publisherDID'],
    ['access_url',        'meta.ref.url',               'Access.reference'],
    ['access_format',     'meta.code.mime',             'Access.format'],
    ['access_estsize',    'phys.size;meta.file',        'Access.size'],
    ['target_name',       'meta.id;src',                'Target.name'],
    ['s_ra',              'pos.eq.ra',                  'Char.SpatialAxis.Coverage.Location.Coord.Position2D.Value2.C1'],
    ['s_dec',             'pos.eq.dec',                 'Char.SpatialAxis.Coverage.Location.Coord.Position2D.Value2.C2'],
    ['s_fov',             'phys.angSize;instr.fov',     'Char.SpatialAxis.Coverage.Bounds.Extent.diameter'],
    ['s_region',          'pos.outline;obs.field',      'Char.SpatialAxis.Coverage.Support.Area'],
    ['s_resolution',      'pos.angResolution',          'Char.SpatialAxis.Resolution.Refval.value'],
    ['s_xel1',            'meta.number',                'Char.SpatialAxis.numBins1'],
    ['s_xel2',            'meta.number',                'Char.SpatialAxis.numBins2'],
    ['t_min',             'time.start;obs.exposure',    'Char.TimeAxis.Coverage.Bounds.Limits.StartTime'],
    ['t_max',             'time.end;obs.exposure',      'Char.TimeAxis.Coverage.Bounds.Limits.StopTime'],
    ['t_exptime',         'time.duration;obs.exposure', 'Char.TimeAxis.Coverage.Support.Extent'],
    ['t_resolution',      'time.resolution',            'Char.TimeAxis.Resolution.Refval.value'],
    ['t_xel',             'meta.number',                'Char.TimeAxis.numBins'],
    ['em_min',            'em.wl;stat.min',             'Char.SpectralAxis.Coverage.Bounds.Limits.LoLimit'],
    ['em_max',            'imit em.wl;stat.max',        'Char.SpectralAxis.Coverage.Bounds.Limits.HiLimit'],
    ['em_res_power',      'spect.resolution',           'Char.SpectralAxis.Resolution.ResolPower.refVal'],
    ['em_xel',            'Char.SpectralAxis.numBins',  'meta.number'],
    ['o_ucd',             'meta.ucd',                   'Char.ObservableAxis.ucd'],
    ['pol_states',        'meta.code;phys.polarization','Char.PolarizationAxis.stateList'],
    ['pol_xel',           'meta.number',                'Char.PolarizationAxis.numBins'],
    ['facility_name',     'meta.id;instr.tel',          'Provenance.ObsConfig.Facility.name'],
    ['instrument_name',   'meta.id;instr',              'Provenance.ObsConfig.Instrument.name']
];

const OBSTAP_OPTIONAL_CNAMES = [
    'dataproduct_subtype', 'target_class', 'obs_title', 'obs_creation_date', 'obs_creator_name',
    'obs_creator_did', 'obs_release_date', 'publisher_id', 'bib_reference', 'data_rights', 's_resolution_max',
    's_calib_status', 's_stat_error', 's_pixel_scale', 't_refpos', 't_calib_status', 't_stat_error',
    'em_ucd', 'em_unit', 'em_calib_status', 'em_res_power_min', 'em_res_power_max', 'em_resolution',
    'em_stat_error', 'o_unit', 'o_calib_status', 'o_stat_error', 'pol_states', 'proposal_id'
];

const OBSTAP_CNAMES = OBSTAPCOLUMNS.map((row) => row[ColNameIdx]).concat( OBSTAP_OPTIONAL_CNAMES);

function getObsTabColEntry(title) {
    const e= OBSTAPCOLUMNS.find( (entry) => entry[ColNameIdx]===title);
    return e && {name:e[ColNameIdx], ucd: e[UcdColIdx], utype: e[UtypeColIdx]};
}

function getObsCoreTableColumn(tableOrId, name) {
    const entry= getObsTabColEntry(name);
    if (!entry) return;
    const table= getTableModel(tableOrId);
    const tblRec= TableRecognizer.newInstance(table);
    let cols= tblRec.getTblColumnsOnUType(entry.utype);
    if (cols.length) {
        if (cols.length===1) return cols[0];
        const prefUtype= cols.find( (c) => c.name===name);
        return prefUtype ? prefUtype : cols[0];
    }
    cols= tblRec.getTblColumnsOnDefinedUCDValue(entry.ucd);
    if (cols.length) {
        if (cols.length===1) return cols[0];
        const prefUcd= cols.find( (c) => c.name===name);
        return prefUcd ? prefUcd : cols[0];
    }
    return getColumn(table,name);
}


function getObsCoreTableColumnName(tableOrId,name) {
    const col = getObsCoreTableColumn(tableOrId,name);
    return col ? col.name : '';
}

export function getObsCoreCellValue(tableOrId, rowIdx, obsColName) {
    const table= getTableModel(tableOrId);
    if (!table) return '';
    return getCellValue(table, rowIdx, getObsCoreTableColumnName(table, obsColName)) || '';
}


const alternateMainPos = [['POS_EQ_RA_MAIN', 'POS_EQ_DEC_MAIN']];
export const posCol = {[UCDCoord.eq.key]: {ucd: [['pos.eq.ra', 'pos.eq.dec'],...alternateMainPos],
                                    coord: CoordinateSys.EQ_J2000, adqlCoord: 'ICRS'},
    [UCDCoord.ecliptic.key]: {ucd: [['pos.ecliptic.lon', 'pos.ecliptic.lat']],
                              coord: CoordinateSys.ECL_J2000, adqlCoord: 'ECLIPTIC'},
    [UCDCoord.galactic.key]: {ucd: [['pos.galactic.lon', 'pos.galactic.lat']],
                              coord: CoordinateSys.GALACTIC, adqlCoord: 'GALATIC'}};

function getLonLatIdx(tableModel, lonCol, latCol) {
    const lonIdx =  getColumnIdx(tableModel, lonCol);
    const latIdx =  getColumnIdx(tableModel, latCol);

    return (lonIdx >= 0 && latIdx >= 0) ? {lonIdx, latIdx} : null;
}

function centerColumnUTypesFromObsTap() {
    const obsTapColNames = OBSTAPCOLUMNS.map((col) => col[ColNameIdx]);

    const centerUTypes = obsCorePosColumns.map((posColName) => {
            const idx = obsTapColNames.indexOf(posColName);

            return (idx >= 0) ? OBSTAPCOLUMNS[idx][UtypeColIdx] : null;
    });

    return centerUTypes.findIndex((oneUtype) => !oneUtype) >= 0 ? null : centerUTypes;
}

const UCDSyntax = new Enum(['primary', 'secondary', 'any'], {ignoreCase: true});
const ucdSyntaxMap = {
            'pos.eq.ra':  UCDSyntax.any,
            'pos.eq.dec': UCDSyntax.any,
            'meta.main':  UCDSyntax.secondary,
            'pos.outline': UCDSyntax.primary,
            'obs.field': UCDSyntax.secondary
};


/**
 * check if ucd value contains the searched ucd word at the right position
 * @param ucdValue
 * @param ucdWord
 * @param syntaxCode 'P': only first word, 'S': only secondary, 'Q' either first or secondary
 */
function isUCDWith(ucdValue, ucdWord, syntaxCode = UCDSyntax.any) {
    const atoms = ucdValue.split(';');
    const idx = atoms.findIndex((atom) => {
        return atom.toLowerCase() === ucdWord.toLowerCase();
    });

    return (syntaxCode === UCDSyntax.primary && idx === 0) ||
           (syntaxCode === UCDSyntax.secondary && idx >= 1) ||
           (syntaxCode === UCDSyntax.any && idx >= 0);
}

/**
 * table analyzer based on table model for catalog or image metadata
 */
class TableRecognizer {
    constructor(tableModel, posCoord='eq') {
        this.tableModel = tableModel;
        this.columns = get(tableModel, ['tableData', 'columns'], []);
        this.obsCoreInfo = {isChecked: false, isObsCoreTable: false};
        this.posCoord = posCoord;
        this.centerColumnsInfo = null;
        this.centerColumnCandidatePairs = null;
        this.regionColumnInfo = null;
    }

    isObsCoreTable() {
        if (this.obsCoreInfo.isChecked) {
            return this.obsCoreInfo.isObsCoreTable;
        }

        const allColNames = this.columns.map((oneCol) => oneCol.name);

        const nonExistCol = OBSTAPCOLUMNS
                            .map((oneColumn) => (oneColumn[ColNameIdx]))
                            .some((oneName) => {
                                return !allColNames.includes(oneName);
                            });

        this.obsCoreInfo.isChecked = true;
        this.obsCoreInfo.isObsCoreTable = !nonExistCol;

        return this.obsCoreInfo.isObsCoreTable;
    }

    /**
     * find and fill center column info
     * @param colPair [lonCol, latCol]
     * @param csys
     * @returns {null|CoordColsDescription}
     */
    setCenterColumnsInfo(colPair, csys = CoordinateSys.EQ_J2000) {
        this.centerColumnsInfo = null;

        if (isArray(colPair) && colPair.length >= 2) {
            const lonCol = isString(colPair[0]) ? colPair[0] : colPair[0].name;
            const latCol = isString(colPair[1]) ? colPair[1] : colPair[1].name;

            const idxs = getLonLatIdx(this.tableModel, lonCol, latCol);

            if (idxs) {
                this.centerColumnsInfo = {
                    type: 'center',
                    lonCol,
                    latCol,
                    lonIdx: idxs.lonIdx,
                    latIdx: idxs.latIdx,
                    csys
                };
            }
        }
        return this.centerColumnsInfo;
    }

    setRegionColumnInfo(col) {
        this.regionColumnInfo = null;

        const idx = getColumnIdx(this.tableModel, col.name);
        if (idx >= 0) {
            this.regionColumnInfo = {
                type: 'region',
                regionCol: col.name,
                regionIdx: idx,
                unit: col.units
            };
        }

        return this.regionColumnInfo;
    }

    /**
     * filter the columns per ucd value defined in the UCD value of relevant OBSTAP column
     * @param ucds ucd value defined in OBSTAP, it may contain more than one ucd values
     * @returns {*}
     */
    getTblColumnsOnDefinedUCDValue(ucds) {
        const ucdList = ucds.split(';');

        return ucdList.reduce((prev, ucd) => {
                prev = prev.filter((oneCol) => {
                    return (has(oneCol, 'UCD') && isUCDWith(oneCol.UCD, ucd, get(ucdSyntaxMap, ucd)));
                });
                return prev;
        }, this.columns);

    }
    /**
     * get columns containing the same ucd value
     * @param ucd
     * @returns {Array}
     */
    getTblColumnsOnUCD(ucd) {
        return this.columns.filter((oneCol) => {
               return (has(oneCol, 'UCD') && isUCDWith(oneCol.UCD, ucd, get(ucdSyntaxMap, ucd)));
            });
    }


    /**
     * get columns containing the utype
     * @param utype
     * @returns {array}
     */
    getTblColumnsOnUType(utype) {
        return this.columns.filter((oneCol) => {
                return has(oneCol, 'utype') && oneCol.utype.includes(utype);
            });
    }

    /**
     * get columns containing ucd word by given table columns
     * @param cols
     * @param ucdWord
     * @returns {array}
     */
    getColumnsWithUCDWord(cols, ucdWord) {
        if (isEmpty(cols)) return [];

        return cols.filter((oneCol) => {
            return has(oneCol, 'UCD') && isUCDWith(oneCol.UCD, ucdWord, get(ucdSyntaxMap, ucdWord));
        });
    }

    /**
     * get center columns pairs by checking ucd values
     * @param coord
     * @returns {Array}  [[pair_1_col_ra, pair_1_col_dec], ...., [pair_n_col_ra, pair_n_col_dec]]
     */
    getCenterColumnPairsOnUCD(coord = this.posCoord || UCDCoord.eq.key) {
        const centerColUCDs = has(posCol, coord ) ? posCol[coord].ucd : null;
        const pairs = [];

        if (!centerColUCDs) {
            return pairs;
        }

        // get 'ra' column list and 'dec' column list
        const posPairs = centerColUCDs.reduce((prev, eqUcdPair) => {
            if (isArray(eqUcdPair) && eqUcdPair.length >= 2) {
                const colsRA = this.getTblColumnsOnUCD(eqUcdPair[0]);
                const colsDec = this.getTblColumnsOnUCD(eqUcdPair[1]);

                 prev[0].push(...colsRA);
                 prev[1].push(...colsDec);
            }
            return prev;
        }, [[], []]);


        const metaMainPair = posPairs.map((posCols, idx) => {
            const mainMetaCols = this.getColumnsWithUCDWord(posCols, mainMeta);
            if (!isEmpty(posCols) && isEmpty(mainMetaCols)) {
                alternateMainPos.find((oneAlt) => {
                    const altCols = this.getColumnsWithUCDWord(posCols, oneAlt[idx], ucdSyntaxMap.any);

                    mainMetaCols.push(...altCols);
                    return !isEmpty(altCols);
                });
            }
            return mainMetaCols;
        });

        if (metaMainPair[0].length || metaMainPair[1].length) {
            if (metaMainPair[0].length === metaMainPair[1].length) {
                for (let i = 0; i < metaMainPair[0].length; i++) {
                    pairs.push([metaMainPair[0][i], metaMainPair[1][i]]);    //TODO: need rules to match the rest pair
                }
            }
        } else if (posPairs[0].length > 0 && posPairs[1].length > 0){
            // find first exact match
            const basicPair = posPairs.map((cols, i)=>cols.find((c) => c.UCD === centerColUCDs[0][i]));
            if (basicPair[0] && basicPair[1]) {
                pairs.push(basicPair);
            } else if (posPairs[0].length === posPairs[1].length) {
                // TODO: how do we separate positions from the related fields, like variance?
                for (let i = 0; i < posPairs[0].length; i++) {
                    pairs.push([posPairs[0][i], posPairs[1][i]]);    //TODO: need rules to match the rest pair
                }
            }
        }

        return pairs;
    }

    getCenterColumnPairsOnUType(columnPairs) {
        const centerUTypes = centerColumnUTypesFromObsTap();

        if (isEmpty(centerUTypes)) return columnPairs;
        let pairs = [];

        /* filter out the column with unequal utype value */
        if (!isEmpty(columnPairs)) {
            pairs = columnPairs.filter((oneColPair) => {
                if ((!has(oneColPair[0], 'utype')) || (!has(oneColPair[1], 'utype')) ||
                    (oneColPair[0].utype.includes(centerUTypes[0]) && oneColPair[1].utype.includes(centerUTypes[1]))) {
                    return oneColPair;
                }
            });
        } else {   // check all table columns
            const posPairs = centerUTypes.map((posUtype) => {
                return this.getTblColumnsOnUType(posUtype);
            });

            if (posPairs[0].length === posPairs[1].length) {
                for (let i = 0; i < posPairs[0].length; i++) {
                    pairs.push([posPairs[0][i], posPairs[1][i]]);    //TODO: need rules to match the rest pair
                }
            }
        }
        return pairs;

    }

    getCenterColumnPairOnName(columnPairs) {
        if (!isEmpty(columnPairs)) {
            return columnPairs.find((onePair) => {
                return (onePair[0].name.toLowerCase() === obsCorePosColumns[0]) &&
                       (onePair[1].name.toLowerCase() === obsCorePosColumns[1]);
            });
        } else {
            const cols = obsCorePosColumns.map((colName) => {
                return getColumn(this.tableModel, colName);
            });
            return (cols[0] && cols[1]) ? cols : [];
        }
    }


    /**
     *
     * @return {String}
     */
    getCenterColumnMetaEntry() {
        this.centerColumnsInfo = null;

        //note: CATALOG_COORD_COLS,POSITION_COORD_COLS are both deprecated and will removed in the future
        const {tableMeta} = this.tableModel || {};
        const {CATALOG_COORD_COLS,POSITION_COORD_COLS,CENTER_COLUMN}= MetaConst;
        if (!tableMeta) return undefined;
        return tableMeta[CENTER_COLUMN] || tableMeta[CATALOG_COORD_COLS] || tableMeta[POSITION_COORD_COLS];
    }

    /**
     * @returns {Boolean}
     */
    isCenterColumnMetaDefined() {
        return Boolean(this.getCenterColumnMetaEntry());
    }


    /**
     * get center columns pair by checking the table meta
     * @returns {null|CoordColsDescription}
     */
    getCenterColumnsOnMeta() {
        const cenData= this.getCenterColumnMetaEntry();
        if (!cenData) return undefined;

        const s= cenData.split(';');
        if (!s || s.length !== 3) {
            return this.centerColumnsInfo;
        }

        return this.setCenterColumnsInfo(s, CoordinateSys.parse(s[2]));
    }


    /**
     * search center columns pair by checking UCD value
     * @returns {null|CoordColsDescription}
     */
    getCenterColumnsOnUCD() {
        this.centerColumnsInfo = null;

        const colPairs = this.getCenterColumnPairsOnUCD(UCDCoord.eq.key);

        if (colPairs && colPairs.length === 1) {
            return this.setCenterColumnsInfo(colPairs[0], posCol[UCDCoord.eq.key].coord);
        } else {
            this.centerColumnCandidatePairs = colPairs;
        }

        return this.centerColumnsInfo;
    }

    /**
     * search center column pairs based on existing candidate pairs or all table columns
     * @param candidatePairs
     * @returns {null|CoordColsDescription}
     */
    getCenterColumnsOnObsCoreUType(candidatePairs) {
        this.centerColumnsInfo = null;

        const colPairs = this.getCenterColumnPairsOnUType(candidatePairs);

        if (colPairs && colPairs.length === 1) {
            this.setCenterColumnsInfo(colPairs[0], posCol[UCDCoord.eq.key].coord);
        }
        this.centerColumnCandidatePairs = colPairs;

        return this.centerColumnsInfo;
    }

    /**
     * search center column pair by checking ObsCore columns on existing candidate pairs or all table columns
     * @param candidatePairs
     * @returns {null|CoordColsDescription}
     */
    getCenterColumnsOnObsCoreName(candidatePairs) {
        this.centerColumnsInfo = null;

        const leftMostCol = (isEmpty(candidatePairs))
                            ? null : candidatePairs[0];

        const colPair = this.getCenterColumnPairOnName(candidatePairs);

        if (isArray(colPair) && colPair.length === 2) {
            return this.setCenterColumnsInfo(colPair, posCol[UCDCoord.eq.key].coord);
        } else {
            return leftMostCol?
                   this.setCenterColumnsInfo(leftMostCol, posCol[UCDCoord.eq.key].coord) :
                   this.centerColumnsInfo;
        }
    }

    /**
     * search center columns pair by guessing the column name
     * @returns {null|CoordColsDescription}
     */
    guessCenterColumnsByName() {
        this.centerColumnsInfo = undefined;

        const columns= getColumns(this.tableModel);

        const findColumn = (colName, regExp) => {
            return columns.find((c) => (c.name === colName || (regExp && regExp.test(c.name))) );
        };

        const guess = (lon, lat, useReg=false) => {

            let lonCol;
            let latCol;
            if (useReg) {
                const reLon= new RegExp(`^[A-z]*[-_]?(${lon})[1-9]*$`);
                const reLat= new RegExp(`^[A-z]*[-_]?(${lat})[1-9]*$`);
                lonCol = findColumn(lon,reLon);
                latCol = findColumn(lat,reLat);
                if (lonCol && latCol) {
                    if (lonCol.name.replace(lon,'') !== latCol.name.replace(lat,'')) return undefined;
                }
            }
            else {
                lonCol = findColumn(lon);
                latCol = findColumn(lat);
            }

            return (lonCol && latCol) ? this.setCenterColumnsInfo([lonCol, latCol]) : undefined;
        };

        return (guess('ra','dec') || guess('lon', 'lat') || guess('ra','dec',true) || guess('lon', 'lat',true));
    }

    /**
     * find center columns as defined in some vo standard
     * @returns {null|CoordColsDescription}
     */
    getVODefinedCenterColumns() {
        return  this.getCenterColumnsOnUCD() ||
            this.getCenterColumnsOnObsCoreUType(this.centerColumnCandidatePairs) ||
            this.getCenterColumnsOnObsCoreName(this.centerColumnCandidatePairs);
    }


    /**
     * return center position or catalog coordinate columns and the associate*d coordinate system
     * by checking table meta, UCD values, Utype, ObsCore column name and guessing.
     * @returns {null|CoordColsDescription}
     */
    getCenterColumns() {

        if (this.isCenterColumnMetaDefined()) return this.getCenterColumnsOnMeta();
        
        return  this.getVODefinedCenterColumns() ||
                (isEmpty(this.centerColumnCandidatePairs) && this.guessCenterColumnsByName());
    }

    getRegionColumnOnUCD(cols) {
        this.regionColumnInfo = null;
        const columns = !isEmpty(cols) ? cols : this.columns;
        const ucds = get(getObsTabColEntry(obsCoreRegionColumn), 'ucd', '').split(';');

        const regionCols = ucds.reduce((prev, oneUcd) => {
            if (prev.length > 0) {
                prev = this.getColumnsWithUCDWord(prev, oneUcd);
            }
            return prev;
        }, columns);

        if (regionCols.length === 1) {
            this.setRegionColumnInfo(regionCols[0]);
        } else if (regionCols.length > 1) {
            if (!this.getRegionColumnOnObsCoreName(regionCols)) {
                this.setRegionColumnInfo(regionCols[0]);
            }
        }
        return this.regionColumnInfo;
    }

    getRegionColumnOnObsCoreUType(cols) {
        const columns = !isEmpty(cols) ? cols : this.columns;
        const obsUtype = get(getObsTabColEntry(obsCoreRegionColumn), 'utype', '');

        this.regionColumnInfo = null;

        const regionCols = (obsUtype) && !isEmpty(columns) && columns.filter((col) => {
            return  (has(col, 'utype') && col.utype.includes(obsUtype));
        });

        if (regionCols.length === 1) {
            this.setRegionColumnInfo(regionCols[0]);
        } else if (regionCols.length > 1) {
            if (!this.getRegionColumnOnObsCoreName(regionCols)) {
                this.setRegionColumnInfo(regionCols[0]);
            }
        }

        return this.regionColumnInfo;
    }

    getRegionColumnOnObsCoreName(cols) {
        this.regionColumnInfo = null;
        const columns = !isEmpty(cols) ? cols : this.columns;

        const regionCol = !isEmpty(columns) && columns.find((oneCol) => oneCol.name.toLowerCase() === obsCoreRegionColumn);
        if (regionCol) {
            this.setRegionColumnInfo(regionCol);
        }
        return this.regionColumnInfo;
    }
    /**
     * return region column by checking column name or UCD values
     * @returns {null|ColDescription}
     */
    getVODefinedRegionColumn() {
         return this.getRegionColumnOnUCD() ||
                this.getRegionColumnOnObsCoreUType()||
                this.getRegionColumnOnObsCoreName();
    }


    getRegionColumn() {
        return this.getVODefinedRegionColumn();
    }

    static newInstance(tableModel) {
        return new TableRecognizer(tableModel);
    }
}

/**
 * find the center column base on the table model of catalog or image metadata
 * Investigate table meta data a return a CoordColsDescription for two columns that represent and object in the row
 * @param table
 * @return {CoordColsDescription|null}
 */
export function findTableCenterColumns(table) {
   const tblRecog = get(table, ['tableData', 'columns']) && TableRecognizer.newInstance(table);
   return tblRecog && tblRecog.getCenterColumns();
}

/**
 * If there are center columns defined with this table then return a WorldPt
 * @param table
 * @param row
 * @return {WorldPt|undefined} a world point or undefined it no center columns exist
 */
export function makeWorldPtUsingCenterColumns(table,row) {
    const cen= findTableCenterColumns(table);
    return cen && makeWorldPt(getCellValue(table,row,cen.lonCol), getCellValue(table,row,cen.latCol), cen.csys);
}


/**
 * find ObsCore defined 's_region' column
 * @param table
 * @return {RegionColDescription|null}  return ObsCore defined s_region column
 */
export function findTableRegionColumn(table) {
    const tblRecog = get(table, ['tableData', 'columns']) && TableRecognizer.newInstance(table);
    return tblRecog && tblRecog.getRegionColumn();
}

/**
 * find the ObsCore defined 'access_url' column
 * @param table
 * @return {TableColumn|null} return ObsCore defined access_url column
 */
export function findTableAccessURLColumn(table) {
    const urlCol = getObsCoreTableColumn(table, 'access_url');
    return isEmpty(urlCol) ? null : urlCol;
}

/**
 * Given a TableModel or a table id return a table model
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @return {TableModel}
 */
function getTableModel(tableOrId) {
    if (isString(tableOrId)) return getTblById(tableOrId);  // was passed a table Id
    if (isObject(tableOrId)) return tableOrId;
    return undefined;
}


/**
 * table analyzer based on the table model for columns which contains column_name & ucd columns
 */
class ColumnRecognizer {
    constructor(columnsModel, posCoord = 'eq') {
        this.columnsModel = columnsModel;
        this.ucds = getColumnValues(columnsModel, 'ucd').map((v) => v || '');
        this.column_names = getColumnValues(columnsModel, 'column_name');
        this.centerColumnsInfo = null;
        this.posCoord = posCoord;
    }


    setCenterColumnsInfo(colPair, csys = CoordinateSys.EQ_J2000) {
        this.centerColumnsInfo = {
            lonCol: colPair[0],
            latCol: colPair[1],
            csys
        };

        return this.centerColumnsInfo;
    }

    getColumnsWithUCDWord(cols, ucdWord) {
        if (isEmpty(cols)) return [];

        return cols.filter((oneCol) => {
            return has(oneCol, 'ucd') && isUCDWith(oneCol.ucd, ucdWord, get(ucdSyntaxMap, ucdWord));
        });
    }

    getCenterColumnPairsOnUCD(coord) {
        const centerColUCDs = has(posCol, coord ) ? posCol[coord].ucd : null;
        const pairs = [];

        if (!centerColUCDs) {
            return pairs;
        }

        // get 'ra' column list and 'dec' column list
        // output in form of [ <ra column array>, <dec column array> ] and each column is like {ucd: column_name: }
        const posPairs = centerColUCDs.reduce((prev, eqUcdPair) => {
            if (isArray(eqUcdPair) && eqUcdPair.length >= 2) {
                const colsRA = this.ucds.reduce((p, ucd, i) => {
                    if (ucd.includes(eqUcdPair[0])) {
                        p.push({ucd, column_name: this.column_names[i]});
                    }
                    return p;
                }, []);
                const colsDec = this.ucds.reduce((p, ucd, i) => {
                    if (ucd.includes(eqUcdPair[1])) {
                        p.push({ucd, column_name: this.column_names[i]});
                    }
                    return p;
                }, []);

                prev[0].push(...colsRA);
                prev[1].push(...colsDec);
            }
            return prev;
        }, [[], []]);


        const metaMainPair = posPairs.map((posCols, idx) => {
            const mainMetaCols = this.getColumnsWithUCDWord(posCols, mainMeta);
            if (!isEmpty(posCols) && isEmpty(mainMetaCols)) {
                alternateMainPos.find((oneAlt) => {
                    const altCols = this.getColumnsWithUCDWord(posCols, oneAlt[idx], ucdSyntaxMap.any);

                    mainMetaCols.push(...altCols);
                    return !isEmpty(altCols);
                });
            }
            return mainMetaCols;
        });

        if (metaMainPair[0].length || metaMainPair[1].length) {  // get the column with ucd containing meta.main
            if (metaMainPair[0].length === metaMainPair[1].length) {
                for (let i = 0; i < metaMainPair[0].length; i++) {
                    pairs.push([metaMainPair[0][i], metaMainPair[1][i]]);    //TODO: need rules to match the rest pair
                }
            }
        } else if (posPairs[0].length > 0 && posPairs[1].length > 0){
            // find first exact match
            const basicPair = posPairs.map((cols, i)=>cols.find((c) => c.ucd === centerColUCDs[0][i]));
            if (basicPair[0] && basicPair[1]) {
                pairs.push(basicPair);
            } else if (posPairs[0].length === posPairs[1].length) {
                // TODO: how do we separate positions from the related fields, like variance?
                for (let i = 0; i < posPairs[0].length; i++) {
                    pairs.push([posPairs[0][i], posPairs[1][i]]);    //TODO: need rules to match the rest pair
                }
            }
        }

        return pairs;
    }

    getCenterColumnsOnUCD() {
        let colPairs;
        const coordSet = this.posCoord ? [UCDCoord[this.posCoord].key] :
                         [UCDCoord.eq.key, UCDCoord.galactic.key, UCDCoord.ecliptic.key];

        coordSet.find((oneCoord) => {
            colPairs = this.getCenterColumnPairsOnUCD(oneCoord);
            if (colPairs && colPairs.length >= 1) {
                this.setCenterColumnsInfo(colPairs[0], posCol[oneCoord].coord);  // get the first pair
                return true;
            } else {
                return false;
            }
        });
        return this.centerColumnsInfo;
    }

    guessCenterColumnsByName() {
        this.centerColumnsInfo = null;

        const findColumn = (colName, regExp) => {
            let col;
            this.column_names.find((name, i) => {
                if (name === colName || (regExp && regExp.test(name))) {
                    col = {column_name: name, ucd: this.ucds[i]};
                    return true;
                } else {
                    return false;
                }
            });
            return col;
        };


        const guess = (lon, lat, useReg=false) => {

            let lonCol;
            let latCol;
            if (useReg) {
                const reLon= new RegExp(`^[A-z]?[-_]?(${lon})[1-9]*$`);
                const reLat= new RegExp(`^[A-z]?[-_]?(${lat})[1-9]*$`);
                lonCol = findColumn(lon,reLon);
                latCol = findColumn(lat,reLat);
            }
            else {
                lonCol = findColumn(lon);
                latCol = findColumn(lat);
            }

            return (lonCol && latCol) ? this.setCenterColumnsInfo([lonCol, latCol]) : this.centerColumnsInfo;
        };
        return (guess('ra','dec') || guess('lon', 'lat') || guess('ra','dec',true) || guess('lon', 'lat',true));
    }


    getCenterColumns() {
        return this.getCenterColumnsOnUCD()||
               this.guessCenterColumnsByName();
    }

    static newInstance(tableModel) {
        return new ColumnRecognizer(tableModel);
    }
}

/**
 * find the center columns based on the columns table model
 * @param columnsModel
 * @returns {*|{lonCol: {ucd, column_name}, latCol: {ucd, column_name}, csys}|*}
 */
export function findCenterColumnsByColumnsModel(columnsModel) {
    const colRecog = columnsModel && get(columnsModel, ['tableData', 'columns']) && ColumnRecognizer.newInstance(columnsModel);

    return colRecog && colRecog.getCenterColumns();
}


/**
 * Test to see it this is a catalog. A catalog must have one of the following:
 *  - CatalogOverlayType meta data entry defined and not equal to 'FALSE' and we must be able to find the columns
 *                            either by meta data or by guessing
 *  - We find the columns by some vo standard
 *
 *  Note- if the CatalogOverlayType meta toUpperCase === 'FALSE' then we will treat it as not a catalog no matter how the
 *  vo columns might be defined.
 *
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @return {boolean} True if the table is a catalog
 * @see MetaConst.CATALOG_OVERLAY_TYPE
 */
export function isCatalog(tableOrId) {
    const table= getTableModel(tableOrId);

    if (!table) return false;
    if (isTableWithRegion(table)) return false;
    const {tableMeta, tableData}= table;
    if (!get(tableData, 'columns') || !tableMeta) return false;

    if (isString(tableMeta[MetaConst.CATALOG_OVERLAY_TYPE])) {
        if (tableMeta[MetaConst.CATALOG_OVERLAY_TYPE].toUpperCase()==='FALSE') return false;
        return Boolean(TableRecognizer.newInstance(table).getCenterColumns());
    }
    else {
        return Boolean(TableRecognizer.newInstance(table).getVODefinedCenterColumns());
    }
}


export function isTableWithRegion(tableOrId) {
    const table= getTableModel(tableOrId);
    if (!table) return false;

    return Boolean(TableRecognizer.newInstance(table).getVODefinedRegionColumn());
}

/**
 * @summary check if there is center column or corner columns defined, if so this table has coverage information
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @returns {boolean} True if there  is coverage data in this table
 */
export function hasCoverageData(tableOrId) {
    const table= getTableModel(tableOrId);
    if (!getBooleanMetaEntry(table,MetaConst.COVERAGE_SHOWING,true)) return false;
    if (!table) return false;
    if (!table.totalRows) return false;
    return !isEmpty(findTableRegionColumn(table)) || !isEmpty(findTableCenterColumns(table)) || !isEmpty(getCornersColumns(table));
}


/**
 * Guess if this table contains image meta data. It contains image meta data if IMAGE_SOURCE_ID is defined
 * or a DATA_SOURCE column name is defined
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @return {boolean} true if there is image meta data
 * @see MetaConst.DATA_SOURCE
 * @see MetaConst.IMAGE_SOURCE_ID
 */
export function isMetaDataTable(tableOrId) {
    const table= getTableModel(tableOrId);
    // const dataSourceUpper = MetaConst.DATA_SOURCE.toUpperCase();
    if (isEmpty(table)) return false;
    const {tableMeta, totalRows} = table;
    if (!tableMeta || !totalRows) return false;

    // const dsCol = Object.keys(tableMeta).find((key) => key.toUpperCase() === dataSourceUpper);
    // if (dsCol && tableMeta[dsCol].toLocaleLowerCase()==='false') return false;
    const dsCol= getDataSourceColumn(table);
    if (dsCol===false) return false;  // if the meta data specifically disables any data sources it will be set to false

    return Boolean(tableMeta[MetaConst.IMAGE_SOURCE_ID] || tableMeta[MetaConst.DATASET_CONVERTER] ||
        dsCol || hasObsCoreLikeDataProducts(table) || isTableWithRegion(tableOrId));
}


function columnMatches(table, cName) {
    if (!table || !cName) return undefined;
    if (getColumn(table,cName)) return cName;
    const cUp= cName.toUpperCase();
    const col= table.tableData.columns.find( (c) => cUp===c.name.toUpperCase());
    return col && col.name;
}

/**
 * Find the a data source column if is is defined in the metadata and a column exist with that name. The
 * meta data entry DataSource is case insensitive matched. The column name is also match case insensitive.
 * The meta data entry can have two forms 'abc' or '[abc,efe,hij]' if it is the second form the the first
 * entry in the array to match a column is returned. The second form is useful when the code defining the DataSource
 * entry is handling a set of table where the data source could be one of several name such
 * as '[url,fileurl,file_url,data_url,data]'
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @return {boolean|undefined|string} the column name if it exist, if the meta data is not included,
 *                                             false if defined but set to 'false' (case insensitive)
 */
export function getDataSourceColumn(tableOrId) {
    const table= getTableModel(tableOrId);
    if (!table || !get(table,'tableData.columns') || !table.tableMeta) return undefined;
    const dsCol= getMetaEntry(table,MetaConst.DATA_SOURCE,'').trim();
    if (!dsCol) return undefined;
    if (dsCol.toLocaleLowerCase()==='false') return false;

    if (dsCol.startsWith('[') && dsCol.endsWith(']')) {
        return columnMatches(table,dsCol
            .substring(1,dsCol.length-1)
            .split(',')
            .find( (s) => columnMatches(table,s.trim())));
    }
    else {
        return columnMatches(table,dsCol);
    }
}



/**
 * Return true this this table can be access as an ObsCore data
 * @param tableOrId
 * @return {boolean}
 */
export function hasObsCoreLikeDataProducts(tableOrId) {
    const table= getTableModel(tableOrId);
    const hasUrl= getObsCoreTableColumn(table,'access_url');
    const hasFormat= getObsCoreTableColumn(table,'access_format');
    const hasProdType= getObsCoreProdTypeCol(table);
    return Boolean(hasUrl && hasFormat && hasProdType);

}


/**
 * return access_format cell data
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @param rowIdx
 * @return {string}
 */
export const getObsCoreAccessFormat= (tableOrId, rowIdx) => getObsCoreCellValue(tableOrId,rowIdx, 'access_format');
/**
 * return access_url cell data
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @param rowIdx
 * @return {string}
 */
export const getObsCoreAccessURL= (tableOrId, rowIdx) => getObsCoreCellValue(tableOrId,rowIdx, 'access_url');
/**
 * return dataproduct_type cell data
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @param rowIdx
 * @return {string}
 */
export const getObsCoreProdType= (tableOrId, rowIdx) => getObsCoreCellValue(tableOrId,rowIdx, 'dataproduct_type');

/**
 * Return the dataproduct_type column
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @return {TableColumn}
 */
export const getObsCoreProdTypeCol= (tableOrId) => getObsCoreTableColumn(tableOrId, 'dataproduct_type');

/**
 * check to see if dataproduct_type cell a votable
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @param rowIdx
 * @return {boolean}
 */
export const isFormatVoTable= (tableOrId, rowIdx) => getObsCoreAccessFormat(tableOrId, rowIdx).toLowerCase().includes('votable');


/**
 * check to see if dataproduct_type is a datalink
 * @param {TableModel|String} tableOrId - a table model or a table id
 * @param rowIdx
 * @return {boolean}
 */
export function isFormatDataLink(tableOrId, rowIdx) {
    const accessFormat= getObsCoreAccessFormat(tableOrId,rowIdx).toLowerCase();
    return accessFormat.includes('votable') && accessFormat.includes('content=datalink');
}



/**
 *
 * @param {TableModel|string} originTableOrId
 * @param {TableModel} dataLinkTable
 * @param {string} filterStr a string to filter out content_type of the results by
 * @param {number} maxSize if defined, don't return anything greater then max size
 * @return {Array.<{url, contentType, size, semantics}>} return an array of objects with url and contentType keys
 */
export function getDataLinkAccessUrls(originTableOrId, dataLinkTable, filterStr='', maxSize=0 ) {
    const originTable= getTableModel(originTableOrId);
    const data= get(dataLinkTable, 'tableData.data', []);
    if (!data.length) return [];
    const urlOptions= get(dataLinkTable, 'tableData.data', []).map( (row,idx) => {
        const url= getCellValue(dataLinkTable,idx,'access_url' );
        const contentType= getCellValue(dataLinkTable,idx,'content_type' ) ||'';
        const size= Number(getCellValue(dataLinkTable,idx,'content_length' ));
        const semantics= getCellValue(dataLinkTable,idx,'semantics' );
        return {url,contentType, size, semantics  };
    }).filter( ({url}) => url && (url.startsWith('http') || url.startsWith('ftp')) );
    return filterStr||maxSize ?
        urlOptions.filter( ({contentType,size}) =>
            contentType.toLowerCase()
                .includes(filterStr) && (maxSize===0 || size<=maxSize )) :
        urlOptions;
}

const DEFAULT_TNAME_OPTIONS = [
    'name',         // generic
    'pscname',      // IRAS
    'target',       //  our own table output
    'designation',  // 2MASS
    'starid'        // PCRS
];

// moved from java, if we decide to use it this is what we had before
export const findTargetName = (columns) => columns.find( (c) => DEFAULT_TNAME_OPTIONS.includes(c));

/**
 * @global
 * @public
 * @typedef {Object} CoordColsDescription
 *
 * @summary And object that describes a pairs of columns in a table that makes up a coordinate
 *
 * @prop {string} type -   content type of the columns, 'center'
 * @prop {string} lonCol - name of the longitudinal column
 * @prop {string} latCol - name of the latitudinal column
 * @prop {number} lonIdx - column index for the longitudinal column
 * @prop {number} latIdx - column index for the latitudinal column
 * @prop {CoordinateSys} csys - the coordinate system to use
 */

/**
 * @global
 * @public
 * @typedef {Object} ColsDescription
 *
 * @summary An object that describe a single column in a table
 *
 * @prop {string} colName - name of the column
 * @prop {number} colIdx - column index for the column
 * @prop {string} unit - unit for the column
 */


/**
 * @global
 * @public
 * @typedef {Object} RegionColDescription
 *
 * @summary An object that describes the column which is ObsCore defined 's_region'
 *
 * @prop {string} type -   content type of the column, 'region'
 * @prop {string} regionCol - name of the column
 * @prop {number} regionIdx - column index for the column
 * @prop {string} unit - unit of the measurement of the region
 */

/**
 * @see {@link http://www.ivoa.net/documents/VOTable/20130920/REC-VOTable-1.3-20130920.html#ToC54}
 * A.1 link substitution
 * @param tableModel    table model with data and columns info
 * @param href          the href value of the LINK
 * @param rowIdx        row index to be resolved
 * @param defval        the field's value, or cell data.  Append field's value to href, if no substitution is needed.
 * @returns {string}    the resolved href after subsitution
 */
export function resolveHRefVal(tableModel, href='', rowIdx, defval='') {
    const vars = href.match(/\${[\w -.]+}/g);
    if (vars) {
        let rhref = href;
        vars.forEach((v) => {
            const [,cname] = v.match(/\${([\w -.]+)}/) || [];
            const col = getColumnByID(tableModel, cname) || getColumn(tableModel, cname);
            const rval = col ? getCellValue(tableModel, rowIdx, col.name) : '';  // if the variable cannot be resolved, return empty string
            rhref = rhref.replace(v, rval);
        });
        return rhref;
    } else {
        return href + defval;
    }

}

/**
 * Guess if this table has enough ObsCore attributes to be considered an ObsCore table.
 * - any column contains utype with 'obscore:' prefix
 * - matches 3 or more of ObsCore column names
 * @param tableModel
 * @returns {boolean}
 */
export function isObsCoreLike(tableModel) {

    const cols = getColumns(tableModel);
    if (cols.findIndex((c) => get(c, 'utype', '').startsWith(obsPrefix)) >= 0) {
        return true;
    };
    const v = intersection(cols.map( (c) => c.name), OBSTAP_CNAMES);
    return v.length > 2;
}
