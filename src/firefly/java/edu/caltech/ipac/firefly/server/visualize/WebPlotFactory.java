/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.visualize;

import edu.caltech.ipac.firefly.server.Counters;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.firefly.server.visualize.imageretrieve.FileRetriever;
import edu.caltech.ipac.firefly.server.visualize.imageretrieve.ImageFileRetrieverFactory;
import edu.caltech.ipac.firefly.visualize.Band;
import edu.caltech.ipac.firefly.visualize.InsertBandInitializer;
import edu.caltech.ipac.firefly.visualize.PlotImages;
import edu.caltech.ipac.firefly.visualize.PlotState;
import edu.caltech.ipac.firefly.visualize.WebFitsData;
import edu.caltech.ipac.firefly.visualize.WebPlotInitializer;
import edu.caltech.ipac.firefly.visualize.WebPlotRequest;
import edu.caltech.ipac.firefly.visualize.ZoomType;
import edu.caltech.ipac.util.Assert;
import edu.caltech.ipac.util.FileUtil;
import edu.caltech.ipac.util.StringUtils;
import edu.caltech.ipac.util.UTCTimeUtil;
import edu.caltech.ipac.util.download.FailedRequestException;
import edu.caltech.ipac.util.download.FileRetrieveException;
import edu.caltech.ipac.visualize.plot.ActiveFitsReadGroup;
import edu.caltech.ipac.visualize.plot.FitsRead;
import edu.caltech.ipac.visualize.plot.GeomException;
import edu.caltech.ipac.visualize.plot.ImageDataGroup;
import edu.caltech.ipac.visualize.plot.ImagePlot;
import nom.tam.fits.FitsException;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static edu.caltech.ipac.firefly.visualize.Band.*;

/**
 * @author Trey Roby
 */
public class WebPlotFactory {

    private static final Logger.LoggerImpl _log = Logger.getLogger();

    static {
        VisContext.init();
    }

    public static WebPlotInitializer[] createNew(String workingCtxStr,
                                                 WebPlotRequest redRequest,
                                                 WebPlotRequest greenRequest,
                                                 WebPlotRequest blueRequest) throws FailedRequestException, GeomException {

        LinkedHashMap<Band, WebPlotRequest> requestMap = new LinkedHashMap<>(5);

        if (redRequest != null) requestMap.put(RED, redRequest);
        if (greenRequest != null) requestMap.put(GREEN, greenRequest);
        if (blueRequest != null) requestMap.put(BLUE, blueRequest);

        return create(workingCtxStr, requestMap, PlotState.MultiImageAction.USE_FIRST, null, true);
    }

    public static WebPlotInitializer[] createNewGroup(String workingCtxStr, List<WebPlotRequest> wprList) throws Exception {


        FileRetriever retrieve = ImageFileRetrieverFactory.getRetriever(wprList.get(0));
        FileData fileData = retrieve.getFile(wprList.get(0));

        FitsRead[] frAry= FitsCacher.readFits(fileData.getFile());
        List<ImagePlotBuilder.Results> resultsList= new ArrayList<>(wprList.size());
        int length= Math.min(wprList.size(), frAry.length);
        WebPlotInitializer retval[]= new WebPlotInitializer[length];
        for(int i= 0; (i<length); i++) {
            WebPlotRequest request= wprList.get(i);
            ImagePlotBuilder.Results r= ImagePlotBuilder.buildFromFile(request, fileData,frAry[i],
                                                                       request.getMultiImageIdx(),null);
            resultsList.add(r);
        }
        for(int i= 0; (i<resultsList.size()); i++) {
            ImagePlotBuilder.Results r= resultsList.get(i);
            ImagePlotInfo pi = r.getPlotInfoAry()[0];
            PlotServUtils.updateProgress(pi.getState().getWebPlotRequest(), ProgressStat.PType.CREATING,
                                         PlotServUtils.PROCESSING_MSG+": "+ (i+1)+" of "+resultsList.size());

            for (Map.Entry<Band, ModFileWriter> entry : pi.getFileWriterMap().entrySet()) {
                ModFileWriter mfw = entry.getValue();
                if (mfw != null) {
                    if (mfw.getCreatesOnlyOneImage()) pi.getState().setImageIdx(0, entry.getKey());
                    mfw.go(pi.getState());
                }
            }

            retval[i] = makePlotResults(pi, true, r.getZoomChoice());
        }
        return retval;
    }


    public static WebPlotInitializer[] createNew(String workingCtxStr, WebPlotRequest request) throws FailedRequestException, GeomException {
        Map<Band, WebPlotRequest> requestMap = new LinkedHashMap<>(2);
        requestMap.put(NO_BAND, request);
        PlotState.MultiImageAction multiAction= PlotState.MultiImageAction.USE_ALL;
        if (request.containsParam(WebPlotRequest.MULTI_IMAGE_IDX)) {
            multiAction= PlotState.MultiImageAction.USE_IDX;
        }
        return create(workingCtxStr, requestMap, multiAction, null, false);
    }

    public static WebPlotInitializer[] recreate(PlotState state) throws FailedRequestException, GeomException {
        Map<Band, WebPlotRequest> requestMap = new LinkedHashMap<Band, WebPlotRequest>(5);
        for (Band band : state.getBands()) requestMap.put(band, state.getWebPlotRequest(band));
        for(WebPlotRequest req : requestMap.values()) {
            req.setZoomType(ZoomType.STANDARD);
            req.setInitialZoomLevel(state.getZoomLevel());
        }
        WebPlotInitializer wpAry[] = create(null, requestMap, null, state, state.isThreeColor());
        Assert.argTst(wpAry.length == 1, "in this case you should never have more than one result");
        return wpAry;
    }

//======================================================================
//------------------ Private / Protected Methods -----------------------
//======================================================================

    private static InsertBandInitializer insertBand(ImagePlot plot,
                                                    PlotState state,
                                                    FileData fd,
                                                    Band band,
                                                    ActiveFitsReadGroup frGroup) throws FailedRequestException, GeomException {

        InsertBandInitializer retval;

        try {
            if (CtxControl.getPlotCtx(state.getContextString()) == null) {
                throw new FailedRequestException("PlotClientCtx not found, ctxStr=" + state.getContextString());
            }

            FileReadInfo frInfo[] = WebPlotReader.readOneFits(fd, band, null);

            ModFileWriter modWriter = ImagePlotCreator.createBand(state, plot, frInfo[0],frGroup);

            WebFitsData wfData = ImagePlotCreator.makeWebFitsData(plot, frGroup, band, frInfo[0].getOriginalFile());
            PlotStateUtil.setPixelAccessInfo(plot, state, frGroup);

            ImagePlotBuilder.initState(state, frInfo[0], band, null);


            PlotImages images = createImages(state, plot, frGroup, true, false);

            if (modWriter != null) {
                if (modWriter.getCreatesOnlyOneImage()) state.setImageIdx(0, band);
                modWriter.go(state);
            }

            PlotServUtils.createThumbnail(plot, frGroup, images, true,state.getThumbnailSize());

            retval = new InsertBandInitializer(state, images, band, wfData, frInfo[0].getDataDesc());

        } catch (FitsException|IOException e) {
            PlotServUtils.statsLog("Fits Read Failed", e.getMessage());
            throw new FailedRequestException("Fits read failed: " + fd.getFile(), null, e);
        } catch (OutOfMemoryError e) {
            PlotServUtils.statsLog("Fits Read Failed", e.getMessage());
            System.gc();
            throw new FailedRequestException("Out of memory: " + fd.getFile(), e.toString(), e);
        }
        return retval;
    }



    private static WebPlotInitializer[] create(String workingCtxStr,
                                               Map<Band, WebPlotRequest> requestMap,
                                               PlotState.MultiImageAction multiAction,
                                               PlotState state,
                                               boolean threeColor) throws FailedRequestException, GeomException {


        long start = System.currentTimeMillis();
        WebPlotRequest saveRequest = requestMap.values().iterator().next();
        WebPlotInitializer retval[];
        if (requestMap.size() == 0) {
            throw new FailedRequestException("Could not create plot", "All WebPlotRequest are null");
        }


        try {

            ImagePlotBuilder.Results allPlots= ImagePlotBuilder.build(workingCtxStr, requestMap,
                                                                      multiAction, state,
                                                                      threeColor);

            // ------------ Iterate through results, Prepare the return objects, including PlotState if it is null
            ImagePlotInfo pInfo[]= allPlots.getPlotInfoAry();
            retval = new WebPlotInitializer[pInfo.length];
            for (int i = 0; (i < pInfo.length); i++) {
                ImagePlotInfo pi = pInfo[i];
                if (i==0) saveRequest= pi.getState().getWebPlotRequest();

                if (pInfo.length>3) {
                    PlotServUtils.updateProgress(pi.getState().getWebPlotRequest(), ProgressStat.PType.CREATING,
                                                 PlotServUtils.PROCESSING_MSG+": "+ (i+1)+" of "+pInfo.length);
                }
                else {
                    PlotServUtils.updateProgress(pi.getState().getWebPlotRequest(),ProgressStat.PType.CREATING,
                                                 PlotServUtils.PROCESSING_MSG);
                }

                for (Map.Entry<Band, ModFileWriter> entry : pi.getFileWriterMap().entrySet()) {
                    ModFileWriter mfw = entry.getValue();
                    if (mfw != null) {
                        if (mfw.getCreatesOnlyOneImage()) pi.getState().setImageIdx(0, entry.getKey());
                        mfw.go(pi.getState());
                    }
                }

                retval[i] = makePlotResults(pi, (i < 3 || i > pInfo.length - 3), allPlots.getZoomChoice());
            }

            if (saveRequest!=null) {
                PlotServUtils.updateProgress(saveRequest, ProgressStat.PType.SUCCESS, "Success");
            }

            long elapse = System.currentTimeMillis() - start;
            logSuccess(pInfo[0].getState(), elapse,
                       allPlots.getFindElapse(), allPlots.getReadElapse(),
                       false, null, true);
        } catch (FileRetrieveException e) {
            makeFailProgressState(saveRequest);
            throw e;
        } catch (FailedRequestException e) {
            makeFailProgressState(saveRequest);
            throw new FailedRequestException("Could not create plot. " , e.getDetailMessage() + ": "+ e.getMessage()   );
        } catch (FitsException e) {
            makeFailProgressState(saveRequest);
            throw new FailedRequestException("Could not create plot. Invalid FITS File format.", e.getMessage());
        } catch (Exception e) {
            makeFailProgressState(saveRequest);
            throw new FailedRequestException("Could not create plot.", e.getMessage(), e);
        }
        return retval;

    }

    private static void makeFailProgressState(WebPlotRequest wpr) {
        if (wpr!=null) PlotServUtils.updateProgress(wpr, ProgressStat.PType.FAIL, "Failed");
    }


    /**
     * @param plot    the image plot
     * @param state   current state
     * @param request request for the insert
     * @param band    which color band
     * @return the insertion initializer
     * @throws FailedRequestException if you can plot the band
     * @throws GeomException when a band can't be reprojected to another band
     */
    public static InsertBandInitializer addBand(ImagePlot plot,
                                                PlotState state,
                                                WebPlotRequest request,
                                                Band band,
                                                ActiveFitsReadGroup frGroup) throws FailedRequestException, GeomException {
        long start = System.currentTimeMillis();
        InsertBandInitializer retval = null;

        state.setWebPlotRequest(request, band);
        File file;
        FileData fd = null;

        long findStart = System.currentTimeMillis();
        FileRetriever retrieve = ImageFileRetrieverFactory.getRetriever(request);
        if (retrieve != null) {
            fd = retrieve.getFile(request);
            file = fd.getFile();
        } else {
            file = null;
            _log.error("failed to find FileRetriever should only be FILE, URL, ALL_SKY, or SERVICE, for band " + band.toString());
        }
        long findElapse = System.currentTimeMillis() - findStart;


        if (file != null) {
            long insertStart = System.currentTimeMillis();
            retval = insertBand(plot, state, fd, band,frGroup);
            long insertElapse = System.currentTimeMillis() - insertStart;
            long elapse = System.currentTimeMillis() - start;

            logSuccess(state, elapse, findElapse, insertElapse, true, band, false);
            state.setNewPlot(false);
        } else {
            _log.error("could not find any fits files from request");
        }

        return retval;
    }

    private static WebPlotInitializer makePlotResults(ImagePlotInfo pInfo,
                                                      boolean       makeFiles,
                                                      ZoomChoice zoomChoice) throws FitsException, IOException {
        PlotState state = pInfo.getState();

        PlotImages images = createImages(state, pInfo.getPlot(), pInfo.getFrGroup(),makeFiles,
                                         zoomChoice.getZoomType() == ZoomType.FULL_SCREEN);

        WebPlotInitializer wpInit = makeWebPlotInitializer(state, images, pInfo);

        CtxControl.initPlotCtx(state, pInfo.getPlot(), pInfo.getFrGroup(), images);

        return wpInit;
    }

    private static WebPlotInitializer makeWebPlotInitializer(PlotState state,
                                                             PlotImages images,
                                                             ImagePlotInfo pInfo) {
        // need a WebFits Data each band: normal is 1, 3 color is three
        WebFitsData wfDataAry[] = new WebFitsData[3];

        for (Map.Entry<Band, WebFitsData> entry : pInfo.getWebFitsDataMap().entrySet()) {
            wfDataAry[entry.getKey().getIdx()] = entry.getValue();
        }

        ImagePlot plot = pInfo.getPlot();
        ImageDataGroup imageData = plot.getImageData();
        return new WebPlotInitializer(state,
                                      images,
                                      plot.getCoordinatesOfPlot(),
                                      plot.getProjection(),
                                      imageData.getImageWidth(),
                                      imageData.getImageHeight(),
                                      pInfo.getFrGroup().getFitsRead(state.firstBand()).getImageScaleFactor(),
                                      wfDataAry,
                                      plot.getPlotDesc(),
                                      pInfo.getDataDesc());
    }


    private static PlotImages createImages(PlotState state,
                                           ImagePlot plot,
                                           ActiveFitsReadGroup frGroup,
                                           boolean makeFiles,
                                           boolean fullScreen) throws IOException {
        String base = PlotServUtils.makeTileBase(state);

        return PlotServUtils.writeImageTiles(ServerContext.getVisSessionDir(),
                                             base, plot, frGroup, fullScreen,
                                             makeFiles ? 2 : 0);

    }

    private static void logSuccess(PlotState state,
                                   long elapse,
                                   long findElapse,
                                   long readElapse,
                                   boolean bandAdded,
                                   Band newBand,
                                   boolean newPlot) {
        String threeDesc = state.isThreeColor() ? "three color " : "";
        String majType = newPlot ? threeDesc + "create plot  " : threeDesc + "recreate plot";
        String minType = "file   ";
        String time3String = bandAdded ? ", Insert-" : ", Read-";
        long totSize = 0;

        List<String> out = new ArrayList<>(8);
        String more = String.format("%s%9s%s%9s",
                                    ", Find-", UTCTimeUtil.getHMSFromMills(findElapse),
                                    time3String, UTCTimeUtil.getHMSFromMills(readElapse));
        out.add(majType + " - " + minType + ": Total: " + UTCTimeUtil.getHMSFromMills(elapse) + more +
                ", Ctx:"+state.getContextString());

        if (bandAdded) {
            String bStr = newBand.toString() + " - ";
            File f = PlotStateUtil.getWorkingFitsFile(state, newBand);
            out.add("band: " + newBand + " added");
            if (!PlotServUtils.isBlank(state, newBand)) {
                String sizeStr= FileUtil.getSizeAsString(f.length());
                out.add(bStr + "filename "+"("+sizeStr+ ")" +": " + f.getPath());
                totSize = f.length();
            } else {
                out.add(bStr + "Blank Image");
            }
        } else {
            for (Band band : state.getBands()) {
                String bStr = state.isThreeColor() ? StringUtils.pad(5, band.toString()) + " - " : "";
                File f = PlotStateUtil.getWorkingFitsFile(state, band);
                if (!PlotServUtils.isBlank(state, band)) {
                    if (f!=null) {
                        String sizeStr= FileUtil.getSizeAsString(f.length());
                        out.add(bStr + "filename "+"("+sizeStr+ ")" +": " + f.getPath());
                        totSize += f.length();
                    }
                } else {
                    out.add(bStr + "Blank Image");
                }
            }
        }
        out.add("PlotState Summary: " + state.toPrettyString());

        String statDetails = String.format("%6s%s", FileUtil.getSizeAsString(totSize), more);
        _log.info(out.toArray(new String[out.size()]));
        PlotServUtils.statsLog("create", "total-MB", (double) totSize / StringUtils.MEG, "Details", statDetails);
        Counters.getInstance().incrementKB(Counters.Category.Visualization, "Total Read", totSize/ StringUtils.K);
    }

}

