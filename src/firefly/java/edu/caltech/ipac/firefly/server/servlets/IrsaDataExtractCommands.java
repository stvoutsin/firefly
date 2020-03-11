package edu.caltech.ipac.firefly.server.servlets;

import edu.caltech.ipac.firefly.data.ServerParams;
import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.data.spectra.Sofia1DSpectraExtractor;
import edu.caltech.ipac.firefly.server.ServCommand;
import edu.caltech.ipac.firefly.server.SrvParam;
import edu.caltech.ipac.table.DataGroup;
import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

import java.io.IOException;

/**
 * Commands to be called to extract, parse and/or translate data in to other file formats and struture
 *
 * Example: SOFIA 1d spectra coded in FITS would be converted and extracted into VOTable
 * with enough information that can be used in UI for charting purposes
 */
public class IrsaDataExtractCommands {

    /**
     * Command to be ran from servlet where URL request link reference the file to get the spectra out
     */
    public static class Sofia1DSpectra extends ServCommand {
        public String doCommand(SrvParam sp) throws IllegalArgumentException {


            JSONObject obj = new JSONObject();
            obj.put("JSON", true);
            obj.put("success", true);

            JSONObject data = new JSONObject();


            // POPULATE DATA OBJECT with spectra?
            // data.put();
//            List<String> idList = sp.getIDList();
//            String file = sp.getRequired(ServerParams.FILE_KEY);

            DataGroup dg = getDataGroup(sp);

            populateJSON(dg, data);

            JSONArray wrapperAry = new JSONArray();
            obj.put("data", data);
            wrapperAry.add(obj);

            return wrapperAry.toJSONString();
        }

        public DataGroup getDataGroup(SrvParam sp) {

            String reqString = sp.getRequired(ServerParams.REQUEST);
            ServerRequest request = ServerRequest.parse(reqString, new ServerRequest());
            DataGroup dg = null;
            try {
                dg = new Sofia1DSpectraExtractor().getDataGroup(request);
                //data.put()
            } catch (IOException e) {
                e.printStackTrace();
            }
            return dg;
        }


        public static void populateJSON(DataGroup dg, JSONObject data) {

            // build json with attribute so it data can be displays as...
            // spectra from NED, Spitzer, SOFIA 1D FITS,etc.etc.

        }

    }

}
