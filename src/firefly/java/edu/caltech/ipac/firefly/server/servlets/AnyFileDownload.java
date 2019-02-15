/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.servlets;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.firefly.server.cache.UserCache;
import edu.caltech.ipac.firefly.server.query.BackgroundEnv;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.util.FileUtil;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.util.cache.Cache;
import edu.caltech.ipac.util.cache.StringKey;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.io.IOException;

/**
 * Date: Feb 11, 2007
 *
 * @author Trey Roby
 * @version $Id: AnyFileDownload.java,v 1.12 2012/12/19 22:36:08 roby Exp $
 */
public class AnyFileDownload extends BaseHttpServlet {

    private static final Logger.LoggerImpl _log= Logger.getLogger();
    private static final Logger.LoggerImpl _statsLog= Logger.getLogger(Logger.DOWNLOAD_LOGGER);


    public static final String HIPS_PARAM  = "hipsUrl"; // required for HiPS
    public static final String FILE_PARAM  = "file"; // required for other request
    public static final String RETURN_PARAM= "return"; // a name for the file, if empty or USE_SERVER_NAME the use file name on server
    public static final String LOG_PARAM   = "log"; // if true, log status
    public static final String TRACK_PARAM = "track"; // if true, send progress to cleint


    public static final String USE_SERVER_NAME = "USE_SERVER_NAME";
    private static final String HIPS_CACHE_CONTROL= "must-revalidate, max-age=1800";
    private static final String HIPS_SHORT_CACHE_CONTROL= "must-revalidate, max-age=300";
    private static final String STATIC_CACHE_CONTROL= "max-age=86400";

    protected void processRequest(HttpServletRequest req, HttpServletResponse res) throws Exception {
        if (req.getParameterMap().containsKey(HIPS_PARAM)) {
            handleHiPSRequest(req,res,true);
        }
        else {
            handleInternalFileRequest(req,res,true);
        }

    }

    @Override
    protected void doHead(HttpServletRequest req, HttpServletResponse res) throws IOException {
        if (req.getParameterMap().containsKey(HIPS_PARAM)) {
            handleHiPSRequest(req,res,false);
        }
        else {
            handleInternalFileRequest(req,res,false);
        }
    }

    private void handleInternalFileRequest(HttpServletRequest req, HttpServletResponse res, boolean fullBody)
            throws IOException {
        SrvParam sp= new SrvParam(req.getParameterMap());
        String fname= sp.getRequired(FILE_PARAM);
        File downloadFile= ServerContext.convertToFile(fname);
        if (downloadFile==null) {
            res.sendError(HttpServletResponse.SC_NOT_FOUND,"Could not convert input to a file" );
            _log.warn("Cannot convert file: "+ fname + " to valid path, returning 404");
        }
        else if (!downloadFile.canRead()) {
            res.sendError(HttpServletResponse.SC_NOT_FOUND,"File was not found" );
            _log.warn("Cannot read file: "+ downloadFile.getPath(),
                    "fname: "+fname, " returning 404");
        }
        else {
            res.addHeader("Cache-Control", STATIC_CACHE_CONTROL);
            if (fullBody) {
                sendFileToClient(req,res,downloadFile);
            }
            else {
                res.setStatus(200);
            }
        }

    }

    private void handleHiPSRequest(HttpServletRequest req, HttpServletResponse res, boolean fullBody)
            throws IOException {
        SrvParam sp= new SrvParam(req.getParameterMap());
        String hips= sp.getRequired(HIPS_PARAM);
        FileInfo fi= HiPSRetrieve.retrieveHiPSData(hips, null);

        if (fi.getFile()==null) {
            if (fi.getResponseCode()==204) {
                res.addHeader("Cache-Control", HIPS_SHORT_CACHE_CONTROL);
                res.addDateHeader("Last-Modified", System.currentTimeMillis());
            }
            res.sendError(fi.getResponseCode(), fi.getResponseCodeMsg());
            return;
        }

        res.addHeader("Cache-Control", HIPS_CACHE_CONTROL);
        res.addDateHeader("Last-Modified", System.currentTimeMillis());
        if (fi.getResponseCode()==304 && req.getDateHeader("If-Modified-Since")> fi.getFile().lastModified()) {
            res.setStatus(304);
            return;
        }
        if (fullBody) {
            sendFileToClient(req,res,fi.getFile());
        }
        else {
            res.setStatus(200);
        }
    }


    private void sendFileToClient(HttpServletRequest req, HttpServletResponse res, File f) throws IOException {
        SrvParam sp= new SrvParam(req.getParameterMap());
        String local= sp.getOptional(RETURN_PARAM);
        boolean log= sp.getOptionalBoolean(LOG_PARAM,false);
        boolean track= sp.getOptionalBoolean(TRACK_PARAM,false);

        String mType= getServletContext().getMimeType(f.getName());
        if (mType!=null) res.setContentType(mType);

        res.addHeader("Content-Length", f.length()+"");

        String retFileStr= (local!=null) ? local : f.getName();
        if (retFileStr.equals(USE_SERVER_NAME)) retFileStr= f.getName();
        if (!StringUtils.isEmpty(retFileStr)) {
            res.addHeader("Content-Disposition", "attachment; filename="+retFileStr);
        }



        if (track) trackProgress(req, BackgroundEnv.DownloadProgress.WORKING);
        try {
            FileUtil.writeFileToStream(f, res.getOutputStream());
            if (track) trackProgress(req, BackgroundEnv.DownloadProgress.DONE);
            if (log) logActivity(f);
        } catch (IOException e) {
            if (track) trackProgress(req, BackgroundEnv.DownloadProgress.FAIL);
            throw e;
        }

    }






    private static void logActivity(File f) {
        String logStr= "File download -- File: " + f.getPath()+
                ", size: " +  FileUtil.getSizeAsString(f.length()) +
                ", bytes: " + f.length();
        _log.briefInfo(logStr);
        _statsLog.stats("file", "size(MB)", (double)f.length()/StringUtils.MEG,
                                         "u", FileUtil.getSizeAsString(f.length()), "file", f.getPath());
    }

    private static void trackProgress(HttpServletRequest req, BackgroundEnv.DownloadProgress progress) {
        StringKey statusKey= new StringKey(req.getQueryString());
        getCache().put(statusKey, progress);
    }

    public static Cache getCache() { return UserCache.getInstance(); }

}
