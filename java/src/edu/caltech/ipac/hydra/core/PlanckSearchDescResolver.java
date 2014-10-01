package edu.caltech.ipac.hydra.core;

import com.google.gwt.i18n.client.NumberFormat;
import edu.caltech.ipac.firefly.core.Application;
import edu.caltech.ipac.firefly.core.SearchDescResolver;
import edu.caltech.ipac.firefly.data.CatalogRequest;
import edu.caltech.ipac.firefly.data.ReqConst;
import edu.caltech.ipac.firefly.data.Request;
import edu.caltech.ipac.firefly.server.dyn.DynServerUtils;
import edu.caltech.ipac.firefly.ui.SimpleTargetPanel;
import edu.caltech.ipac.firefly.ui.creator.SearchDescResolverCreator;
import edu.caltech.ipac.firefly.ui.creator.WidgetFactory;
import edu.caltech.ipac.util.StringUtils;

/**
 * Created by IntelliJ IDEA.
 * User: wmi
 * Date: Oct 21, 2011
 * Time: 4:55:06 PM
 * To change this template use File | Settings | File Templates.
 */
public class PlanckSearchDescResolver extends SearchDescResolver implements SearchDescResolverCreator {

    public static final String ID = "planck-" + WidgetFactory.SEARCH_DESC_RESOLVER_SUFFIX;

    private final static NumberFormat nf= NumberFormat.getFormat("#.###");

    public SearchDescResolver create() {
        return this;
    }

    public String getTitle(Request req) {
        String title = Application.getInstance().getProperties()
                        .getProperty(req.getCmdName() + ".Title", req.getShortDesc());

        return title;
    }

    public String getDesc(Request req) {
        String cmd = req.getCmdName() == null ? "" : req.getCmdName();
        if (cmd.equals("Hydra_planck_planck_1")) {
            return getBandDesc(req);
        } else if (cmd.equals("Hydra_planck_planck_2")) {
            return getPositionDesc(req);
        } else if (cmd.equals("Hydra_planck_planck_3")) {
            return getBandDesc3(req);
        } else if (cmd.equals("Hydra_planck_planck_4")) {
            return getBandDesc2(req);
        } else if (cmd.equals("Hydra_planck_planck_5")) {
            return getCutoutDesc(req);
        } else if (cmd.equals("Hydra_planck_planck_6")) {
            return getTOIDesc(req);
        } else if (cmd.equals("Hydra_planck_planck_8")) {
                   return getCutoutDesc(req);
        } else if (cmd.equals("Hydra_planck_planck_7")) {
                    return getBandDesc2(req);
        } else {
            return super.getDesc(req);
        }
    }

//====================================================================
//
//====================================================================

    private String getBandDesc(Request req) {
        String bandId = req.getParam("optBand");
        bandId = StringUtils.isEmpty(bandId) ? "" : "Freq(s)=" + bandId + "GHz";

        return bandId;
    }

    private String getBandDesc3(Request req) {
        String bandId = req.getParam("planckfreq");
        bandId = StringUtils.isEmpty(bandId) ? "" : " Freq=" + bandId + "GHz, ";

        return getPositionDesc(req) + bandId + getDetector(req);
    }

    private String getTOIDesc(Request req) {
            String bandId = req.getParam("planckfreq");
            String detector = req.getParam("detector");
            bandId = StringUtils.isEmpty(bandId) ? "" : " Freq=" + bandId + "GHz, ";

            return getPositionDesc(req) + bandId + getDetector(req)+ getTimeRang(req);
    }

    private String getBandDesc2(Request req) {
        String bandId = req.getParam("optBand");
        String constraints = req.getParam(CatalogRequest.CONSTRAINTS);
        String retval = StringUtils.isEmpty(bandId) ? "" : "Freq(s)=" + bandId + "GHz";
        retval += StringUtils.isEmpty(constraints) ? "" : "; "+constraints;
    return retval;
    }

    private String getPositionDesc(Request req) {
        String targetStr = req.getParam(SimpleTargetPanel.TARGET_NAME_KEY);
        if (targetStr==null) {
            String wptStr[] = req.getParam(ReqConst.USER_TARGET_WORLD_PT).split(";");
            targetStr = nf.format(Double.parseDouble(wptStr[0]))+" "+
                    nf.format(Double.parseDouble(wptStr[1]))+" "+
                    wptStr[2];
        }
        String source = "Target="+targetStr;
        return source + getSearchRadius(req) + getBandDesc(req);
    }

    private String getCutoutDesc(Request req) {
        return getPositionDesc(req) + getCutoutSize(req) + getMapscale(req) + getScalefactor(req);

    }

    private String getDetector(Request req) {
        String bandId = req.getParam("planckfreq");
        String detector = "";
        if (!StringUtils.isEmpty(bandId)) {
            if (bandId.equals("100")) {
                detector = req.getParam("detc100");}
            else if (bandId.equals("143")) {
                detector = req.getParam("detc143");}
            else if (bandId.equals("217")) {
                detector = req.getParam("detc217");}
            else if (bandId.equals("030")) {
                detector = req.getParam("detc030");}
            else if (bandId.equals("044")) {
                detector = req.getParam("detc044");}
            else if (bandId.equals("070")) {
                detector = req.getParam("detc070");}
            else if (bandId.equals("353")) {
                detector = req.getParam("detc353");}
            else if (bandId.equals("545")) {
                detector = req.getParam("detc545");}
            else if (bandId.equals("857")) {
                detector = req.getParam("detc857");}
        }

        detector = StringUtils.isEmpty(detector) ? "" : " Detector(s): " + detector;

        return detector;
    }

    private String getSourceDesc(Request req) {
        String sourceid = req.getParam("sourceId");
        sourceid = StringUtils.isEmpty(sourceid) ? "" : sourceid;
        String from = req.getParam("sourceLevel");
        from = StringUtils.isEmpty(from) ? "" : " from " + from;


        return sourceid + from + getSearchType(req) + getSearchRadius(req) +
                getCutoutSize(req) + getDataProduct(req) + getImagesetSelection(req);
    }

    private String getImagesetSelection(Request req) {
        String schema = req.getParam("schema");
        return StringUtils.isEmpty(schema) ? "" : "; " + schema;
    }

    private String getDataProduct(Request req) {
        String optLevel = req.getParam("optLevel");
        return StringUtils.isEmpty(optLevel) ? "" : "; Product Level=" + optLevel;
    }

    private String getSearchType(Request req) {
        String intersect = req.getParam("intersect");
        return StringUtils.isEmpty(intersect) ? "" : "; Type=" + intersect;
    }

    private String getSearchRadius(Request req) {
        String searchType = req.getParam("type");
        String radius = req.getParam("radius");
        String boxSize = req.getParam("boxsize");
        String searchSize = radius;
        if (!StringUtils.isEmpty(searchType)) {
            if (searchType.equals("circle")) {
                searchSize = radius;
            } else if (searchType.equals("box")) {
                searchSize = boxSize;
            }
        }

        return StringUtils.isEmpty(searchSize) ? "" : "; Region=" + toDegString(searchSize)+ ";";
    }

    private String getCutoutSize(Request req) {
        String cutout = req.getParam("subsize");
        String mapscale = req.getParam("mapscale");
        if (!StringUtils.isEmpty(mapscale) && mapscale.equals("yes")) cutout = "";
        return StringUtils.isEmpty(cutout) ? "" : "; Cutout Image Size=" + toDegString(cutout);
    }

    private String getMapscale(Request req) {
        String mapscale = req.getParam("mapscale");
        return StringUtils.isEmpty(mapscale) ? "" : "; Planck Cutout Image Scaled: " + mapscale;
    }

    private String getScalefactor(Request req) {
        String fscale = req.getParam("sfactor");
        return StringUtils.isEmpty(fscale) ? "" : "; Planck Cutout Image Scale factor: " + fscale;
    }

    private String getTimeRang(Request req) {
            String timestart = req.getParam("timeStart");
            String timeend = req.getParam("timeEnd");
            return StringUtils.isEmpty(timestart) ? "" : "; Time Range : " + (timestart)+" -- " + (timeend);
        }
}

/*
* THIS SOFTWARE AND ANY RELATED MATERIALS WERE CREATED BY THE CALIFORNIA
* INSTITUTE OF TECHNOLOGY (CALTECH) UNDER A U.S. GOVERNMENT CONTRACT WITH
* THE NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA). THE SOFTWARE
* IS TECHNOLOGY AND SOFTWARE PUBLICLY AVAILABLE UNDER U.S. EXPORT LAWS
* AND IS PROVIDED AS-IS TO THE RECIPIENT WITHOUT WARRANTY OF ANY KIND,
* INCLUDING ANY WARRANTIES OF PERFORMANCE OR MERCHANTABILITY OR FITNESS FOR
* A PARTICULAR USE OR PURPOSE (AS SET FORTH IN UNITED STATES UCC 2312-2313)
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

