package edu.caltech.ipac.firefly.server.servlets;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.data.spectra.Sofia1DSpectraExtractor;
import edu.caltech.ipac.firefly.server.ServerCommandAccess;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.table.DataGroup;
import edu.caltech.ipac.util.CollectionUtil;
import edu.caltech.ipac.util.download.URLDownload;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.File;
import java.net.URL;

/**
 * Commands to be called to extract, parse and/or translate data in to other file formats and struture
 *
 * Example: SOFIA 1d spectra coded in FITS would be converted and extracted into VOTable
 * with enough information that can be used in UI for charting purposes
 */
public class DataToolCommands {

    static abstract class BaseServletCommand extends ServerCommandAccess.HttpCommand {
        // leaving a stuff here just in case it's useful.
    }

    public static class Sofia1DService extends BaseServletCommand {

        private static final Logger.LoggerImpl SERV_LOGGER = Logger.getLogger(Sofia1DService.class);

        void logStats(Object... params) {
            SERV_LOGGER.stats("Extract1dSpectra",
                    "params", CollectionUtil.toString(params, ","));
        }

        @Override
        public void processRequest(HttpServletRequest req, HttpServletResponse res, SrvParam sp) throws Exception {
//localhost:8080/firefly/sticky/CmdSrv?cmd=sofia1d&url=https://irsa.ipac.caltech.edu:443/data/SOFIA/FORCAST/OC5K/20170926_F433/proc/p4792/data/g2/F0433_FO_GRI_9000644_FORG063_RSP_0105.fits

          //  throw new NotImplementedException(Sofia1DService.class.getCanonicalName() + " not yet implemented");
            String url = req.getParameter("url");

            File tempFile = File.createTempFile("Sofia1DSpectraExtractor-", ".fits");
            FileInfo file = URLDownload.getDataToFile(new URL(url), tempFile);
            DataGroup dg = new Sofia1DSpectraExtractor().getDataGroup(file.getFile());


            Sofia1DSpectraExtractor.dataGroup2VOTable(dg, res.getOutputStream());
//            res.setHeader("Content-Disposition", "attachment; filename="+fi.getExternalName());
//            if (fi != null) {
//                long length = fi.getSizeInBytes(); // if written from the db, the length is 0
//                logStats(length, "fileName", fi.getExternalName());
//                // maintain counters for applicaiton monitoring
//                Counters.getInstance().increment(Counters.Category.Download, "SaveAsIpacTable");
//                Counters.getInstance().incrementKB(Counters.Category.Download, "SaveAsIpacTable (KB)", length/1024);
//            }

        }
    }
}
