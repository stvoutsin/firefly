package edu.caltech.ipac.firefly.server.query.ztf;

import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.server.query.SearchProcessorImpl;
import edu.caltech.ipac.firefly.server.query.URLFileInfoProcessor;
import edu.caltech.ipac.firefly.server.util.QueryUtil;
import edu.caltech.ipac.util.AppProperties;
import edu.caltech.ipac.util.StringUtils;
//import edu.caltech.ipac.firefly.server.query.ztf.ZtfRequest;

import java.net.MalformedURLException;
import java.net.URL;

/**
 * Created by wmi
 * on 8/16/17
 * edu.caltech.ipac.hydra.server.query
 */

@SearchProcessorImpl(id = "ZtfSciimsFileRetrieve")
public class ZtfSciimsFileRetrieve extends URLFileInfoProcessor {

    public static final boolean USE_HTTP_AUTHENTICATOR = false;
    public static final String ZTF_DATA_RETRIEVAL_TYPE = AppProperties.getProperty("ztf.data_retrieval_type");  // url or filesystem
    public static final String ZTF_FILESYSTEM_BASEPATH = AppProperties.getProperty("ztf.filesystem_basepath");

    public static enum FILE_TYPE {
        SCI,MASK,RAW,SEXCATL,PSFCATL,SCIIMGDAO,SCIIMGDAOPSFCENT,SCIIMLOG,SCIMREFDIFFIMG,DIFFIMGPSF,DIFFIMLOG,SCILOG
    }

    // example: http://irsadev.ipac.caltech.edu/ibe/data/ztf/products/sci?lon={center lon}&lat={center lat}&size={subsize}
    public static String createCutoutURLString_l1(String baseUrl, String filefracday, String field, String filtercode, String ccdid, String imgtypecode, String qid, FILE_TYPE type, String lon, String lat, String size) {
        String url = baseUrl;
        if (!url.endsWith("/")){
            url += "/";
        }

        url += getFilePath_sci(filefracday,field,filtercode,ccdid,imgtypecode,qid,type);
        url += "?center=" + lon + "," + lat + "&size=" + size;

        return url;
    }

    public static String createFilepath_l1(String filefracday, String field, String filtercode, String ccdid, String imgtypecode, String qid, FILE_TYPE type) {
//        String filepath = ZTF_FILESYSTEM_BASEPATH.trim();
//        filepath += filepath.endsWith("/") ? "" : "/";
//        return filepath + getFilePath_sci(filefracday, field,filtercode,ccdid,imgtypecode,qid, type);
        return  getFilePath_sci(filefracday, field,filtercode,ccdid,imgtypecode,qid, type);
    }


    // example for raw image retrieve /raw/YYYY/MMDD/ccd<ccdid>/ztf_<YYYYMMDDddddd>_<filterID>_c<ccdID>_<imgtype>.fits.fz
    // example for cal files retrieve

    public static String getBaseURL(ServerRequest sr) {
        String host = sr.getSafeParam("host") != null ? sr.getSafeParam("host") : ZtfFileRetrieve.IBE_HOST;
        String schemaGroup = sr.getSafeParam("schemaGroup")!= null ? sr.getSafeParam("schemaGroup"):"ztf";
        String schema = sr.getSafeParam("schema");
//        String table = sr.getSafeParam("table");

//        return QueryUtil.makeUrlBase(host) + "/data/" + schemaGroup + "/" + schema + "/" + table + "/";
        return QueryUtil.makeUrlBase(host) + "/data/" + schemaGroup + "/" + schema + "/";
    }

    private static String getFilePath_sci(String filefracday, String field, String filtercode, String ccdid, String imgtypecode, String qid, FILE_TYPE type){

        String YYYY = filefracday.substring(0,4);
        String MMDD = filefracday.substring(4,8);
        String dddddd = filefracday.substring(8,14);
        String formatccdid = ("00" + ccdid).substring(ccdid.length());
        String formatfield =  ("000000" + field).substring(field.length());
        String baseDir = "sci/" + YYYY + "/" + MMDD+ "/" + dddddd +"/";
        String rawbaseDir = "raw/" + YYYY + "/" + MMDD+ "/" + dddddd +"/";
        String baseFile = baseDir + "ztf_" + filefracday + "_" + formatfield +"_" + filtercode +"_c" + formatccdid + "_" + imgtypecode + "_q" + qid;
        String rawbaseFile = rawbaseDir + "ztf_" + filefracday + "_" + formatfield +"_" + filtercode +"_c" + formatccdid + "_o.fits.fz";

        if (type == FILE_TYPE.SCI) {
            baseFile += ZtfRequest.SCIIMAGE;
        } else if (type == FILE_TYPE.MASK) {
            baseFile += ZtfRequest.MSKIMAGE;
        } else if (type == FILE_TYPE.SEXCATL) {
            baseFile += ZtfRequest.SEXCATL;
        } else if (type == FILE_TYPE.PSFCATL) {
            baseFile += ZtfRequest.PSFCATL;
        } else if (type == FILE_TYPE.RAW) {
            baseFile = rawbaseFile;
        } else if (type == FILE_TYPE.SCIIMGDAO) {
            baseFile += ZtfRequest.SCIIMGDAO;
        } else if (type == FILE_TYPE.SCIIMGDAOPSFCENT) {
            baseFile += ZtfRequest.SCIIMGDAOPSFCEN;
        } else if (type == FILE_TYPE.SCIIMLOG) {
            baseFile += ZtfRequest.SCIIMLOG;
        } else if (type == FILE_TYPE.SCIMREFDIFFIMG) {
            baseFile += ZtfRequest.SCIMREFDIFFIMG;
        } else if (type == FILE_TYPE.DIFFIMGPSF) {
            baseFile += ZtfRequest.DIFFIMGPSF;
        } else if (type == FILE_TYPE.DIFFIMLOG) {
            baseFile += ZtfRequest.DIFFIMLOG;
        } else if (type == FILE_TYPE.SCILOG) {
            baseFile += ZtfRequest.SCILOG;
        }

        return baseFile;
    }


    //build file path
    //  sci/<YYYY>/<MMDD>/<dddddd>/ztf_<YYYYMMDDddddd>_<field>_<filterID>_c<ccdID>_<imgtype>_q<quadID>_<ptype>
    // example: sci/2017/1023/249688/ztf_20171023249688_904000_zr_c01_o_q3_sciimg.fits
    private static URL getIbeURL(ServerRequest sr, boolean doCutOut) throws MalformedURLException {
        // build service
        String baseUrl = getBaseURL(sr);
        String field = sr.getSafeParam("field");
        String filtercode = sr.getSafeParam("filtercode");
        String ccdid = sr.getSafeParam("ccdid");
        String qid = sr.getSafeParam("qid");
        String filefracday = sr.getSafeParam("filefracday");
        String imgtypecode = sr.getParam("imgtypecode");

        //will need to process the parameters into strings for directory and filename
//        String YYYY = filefracday.substring(0,4);
//        String MMDD = filefracday.substring(4,8);
//        String formatccdid = ("00" + ccdid).substring(ccdid.length());
//        String formatfield =  ("000000" + field).substring(field.length());
//        String baseDir = YYYY+ "/" + MMDD+ "/ccd" + formatccdid+ "/field" + field +"/";
//
//        String baseFile = baseDir + "ztf_" + filefracday + "_" + formatfield +"_" + filtercode +"_c" + formatccdid + "_" + imgtypecode + "_q" + qid + "_sciimg.fits";

        String baseFile = getFilePath_sci(filefracday,field,filtercode,ccdid,imgtypecode,qid,FILE_TYPE.SCI);

        if (doCutOut) {
            // look for ra_obj returned by moving object search
            String subLon = sr.getSafeParam("ra_obj");
            if (StringUtils.isEmpty(subLon)) {
                // next look for in_ra returned IBE
                subLon = sr.getSafeParam("in_ra");
                if (StringUtils.isEmpty(subLon)) {
                    // all else fails, try using crval1
                    subLon = sr.getSafeParam("crval1");
                }
            }

            // look for dec_obj returned by moving object search
            String subLat = sr.getSafeParam("dec_obj");
            if (StringUtils.isEmpty(subLat)) {
                // next look for in_dec retuened by IBE
                subLat = sr.getSafeParam("in_dec");
                if (StringUtils.isEmpty(subLat)) {
                    // all else fails, try using crval2
                    subLat = sr.getSafeParam("crval2");
                }
            }

            String subSize = sr.getSafeParam("subsize");

            return new URL(createCutoutURLString_l1(baseUrl,filefracday,field,filtercode,ccdid,imgtypecode,qid,FILE_TYPE.SCI, subLon, subLat, subSize));
        } else {
            return new URL(baseUrl + baseFile);
        }

    }

    public URL getURL(ServerRequest sr) throws MalformedURLException {
        if (sr.containsParam("subsize")) {
            return getIbeURL(sr, true);
        } else {
            return getIbeURL(sr, false);
        }
    }

    @Override
    protected boolean identityAware() {
        return true;
    }
}

/*
 * THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA
 * INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH
 * THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE
 * IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS
 * AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND,
 * INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR
 * A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312- 2313)
 * OR FOR ANY PURPOSE WHATSOEVER, FOR THE SOFTWARE AND RELATED MATERIALS,
 * HOWEVER USED.
 *
 * IN NO EVENT SHALL CALTECH, ITS JET PROPULSION LABORATORY, OR NASA BE LIABLE
 * FOR ANY DAMAGES AND/OR COSTS, INCLUDING, BUT NOT LIMITED TO, INCIDENTAL
 * OR CONSEQUENTIAL DAMAGES OF ANY KIND, INCLUDING ECONOMIC DAMAGE OR INJURY TO
 * PROPERTY AND LOST PROFITS, REGARDLESS OF WHETHER CALTECH, JPL, OR NASA BE
 * ADVISED, HAVE REASON TO KNOW, OR, IN FACT, SHALL KNOW OF THE POSSIBILITY.
 *
 * RECIPIENT BEARS ALL RISK RELATING TO QUALITY AND PERFORMANCE OF THE SOFTWARE
 * AND ANY RELATED MATERIALS, AND AGREES TO INDEMNIFY CALTECH AND NASA FOR
 * ALL THIRD-PARTY CLAIMS RESULTING FROM THE ACTIONS OF RECIPIENT IN THE USE
 * OF THE SOFTWARE.
 */
