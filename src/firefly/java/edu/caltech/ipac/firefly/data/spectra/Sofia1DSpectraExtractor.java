package edu.caltech.ipac.firefly.data.spectra;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.firefly.server.ServerContext;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.table.DataGroup;
import edu.caltech.ipac.table.DataObject;
import edu.caltech.ipac.table.DataType;
import edu.caltech.ipac.table.io.VoTableWriter;
import edu.caltech.ipac.util.FitsHDUUtil;
import edu.caltech.ipac.util.download.URLDownload;
import edu.caltech.ipac.visualize.plot.plotdata.FitsRead;
import edu.caltech.ipac.visualize.plot.plotdata.FitsReadFactory;
import nom.tam.fits.BasicHDU;
import nom.tam.fits.Fits;
import nom.tam.fits.FitsException;
import nom.tam.fits.Header;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URL;
import java.util.ArrayList;

import static edu.caltech.ipac.table.TableUtil.Format.VO_TABLE_TABLEDATA;

/**
 * Util class to extract 1d spectra from SOFIA FITS file -
 * particular SOFIA instruments and data product levels encoded spectra in an image,
 * each row of the image represents a data vector flux, wavelength, etc.
 * Intruments ("processing, product type")
 * FORCAST (L2 rspscpec, mrgspec, combspec),
 * EXES (L3 mrgordspec, combspec, spec),
 * FLITECAM (L3 combspec, calspec)
 *
 * See processing:
 * https://irsa.ipac.caltech.edu/TAP/sync?QUERY=SELECT+distinct+o.instrument_name,jsonb_extract_path_text(p.provenance_keywords,%27PROCSTAT%27,%270%27)+as+processing+FROM+sofia.observation+o,sofia.plane+p+where+o.obsid=p.obsid&format=IPAC_TABLE
 * See product type:
 * https://irsa.ipac.caltech.edu/TAP/sync?QUERY=SELECT+distinct+o.instrument_name,jsonb_extract_path_text(p.provenance_keywords,%27PRODTYPE%27,%270%27)+as+product_type+FROM+sofia.observation+o,sofia.plane+p+where+o.obsid=p.obsid&format=IPAC_TABLE
 */
public class Sofia1DSpectraExtractor extends DataExtractUtil {

    private static final Logger.LoggerImpl _log = Logger.getLogger();

    public DataGroup getDataGroup(File inFile) throws IOException {
//        String param = req.getParam(SofiaConfig.INSTRUMENT);
//        String fileURI = req.getParam("file");
        DataGroup dg = null;
        try {
            dg = extract1DSpectra(inFile, new SofiaSpectraModel());

        } catch (FitsException e) {
            //throw data exception with proper message of the file to extract
            e.printStackTrace();
        }
        return dg;
    }

    public DataGroup getDataGroup(ServerRequest req) throws IOException {
//        String param = req.getParam(SofiaConfig.INSTRUMENT);
//        String fileURI = req.getParam("file");
        DataGroup dg = null;
        try {

            String dataset = req.getParam("dataset");

            VOSpectraModel model = null;
            if (dataset.equalsIgnoreCase("sofia")) {
                model = new SofiaSpectraModel();
            }
            dg = extract1DSpectra(getSourceFile(req), model);

        } catch (FitsException e) {
            //throw data exception with proper message of the file to extract
            e.printStackTrace();
        }
        return dg;
    }

//    public static DataGroup extract1DSpectra(File sourceFile, VOSpectraModel model) throws FitsException, IOException {
////        List<DataType> meta = model.getMeta();//FIELDs
//        String[] meta = null;
//        return FITSTableReader.convertFitsToDataGroup(sourceFile.getAbsolutePath(),new String[]{"Flux", "Wavelength"}, meta, FITSTableReader.DEFAULT,0);
//    }

    /*
           Extract table flux,wavelength and other dataset into class Spectra1D
           #   Confirm that the data HDU shape is as expected.  This kind of file has four stripes of data:
           #     0: wavenumber
           #     1: flux per wavenumber bin
           #     2: flux error
           #     3: reference spectrum
                 4...
                 most likely file is a cache of the reference/source data (FITS)
            */
    public static DataGroup extract1DSpectra(File file, VOSpectraModel model) throws FitsException {

        Fits fit = new Fits(file);
        FitsRead[] fitsReadArray = FitsReadFactory.createFitsReadArray(fit);
        int hdu = fitsReadArray.length;
        if (hdu > 1)
            throw new FitsException("Can't extract SOFIA spectra: number of HDU is " + hdu);
        BasicHDU p = fitsReadArray[0].getHDU();

        int axis[] = new int[]{0, 0};
        String xunit = null, yunit = null;
        double[][] fdata = new double[0][];
        Header hdr = p.getHeader();
        System.out.println(p.getHeader());

        String xu = hdr.getStringValue("XUNITS");
        String yu = hdr.getStringValue("YUNITS");

        xunit = xu != null ? xu : "-";
        yunit = yu != null ? yu : "-";

        // Populate units,ucds
        model.setUnits(VOSpectraModel.SPECTRA_FIELDS.FLUX, yu);
        model.setUnits(VOSpectraModel.SPECTRA_FIELDS.WAVELENGTH, xu);
        model.setUcd(VOSpectraModel.SPECTRA_FIELDS.FLUX, "phot.flux.density");
        model.setUcd(VOSpectraModel.SPECTRA_FIELDS.WAVELENGTH, "em.wl");

        System.out.println(xu + ", " + yu);

        axis[0] = hdr.getIntValue("NAXIS1");
        axis[1] = hdr.getIntValue("NAXIS2");
        System.out.println("nvalues:" + axis[0] + " by nrows:" + axis[1]);
        if (is64bits(hdr, "BITPIX")) {
//                    fdata = new double[axis[0]][axis[1]];
            fdata = (double[][]) p.getKernel();

        } else {
            // fdata = new float[][];
        }


//        FitsRead data = fitsReadArray[0];
//        double[] a = new double[data.getNaxis1()];
//        int r = 0;
//        for (int i=0;i<data.getNaxis1();i++){
//            a[i] = data.getDataFloat()[i+r];
//        }
//        r+=data.getNaxis1();
//        double[] flux = new double[data.getNaxis1()];
//        for (int i=0;i<data.getNaxis1();i++){
//            flux[i] = data.getDataFloat()[i+r];
//        }

        ArrayList<DataType> dt = new ArrayList<DataType>(model.getMeta().values());
        DataGroup dataGroup = new DataGroup(hdr.getStringValue("NAME"), dt);

        DataType[] dd;
        for (int row = 0; row < fdata[0].length; row++) {
            DataObject aRow = new DataObject(dataGroup);
            dd = dt.toArray(new DataType[dt.size()]);
            for (int dtIdx = 0; dtIdx < dd.length; dtIdx++) {
                aRow.setDataElement(dd[dtIdx], fdata[dtIdx][row]);
            }
            dataGroup.add(aRow);
        }
        dataGroup.trimToSize();
        return dataGroup;

        //return new SofiaSpectra(new SofiaSpectra.Axis(fdata[0], xunit), new SofiaSpectra.Axis(fdata[1], yunit));
    }

    public boolean isSpectra(String key, String value) {
        return key.equals("NAXIS") && Integer.parseInt(value) == 2;
    }

    static boolean is64bits(Header hdr, String value) {
        int val = hdr.getIntValue(value);
        if (val == -64) {
            return true;
        } else {
            return false;
        }
    }

    /*
    SOFIA product where spectra 1d (flux vs wavelength tipially is coded in an image with at least 2 rows, first wavlenegtth and 2 flux.
     */
    public enum SpectraInstrument {

        FORCAST(SofiaSpectraModel.INSTRUMENTS.FORCAST, 0, 1, "Flux", "Wave", "jy", ""),
        EXES(SofiaSpectraModel.INSTRUMENTS.EXES, 0, 1, "Flux", "Wave", "jy", ""),
        FLITECAM(SofiaSpectraModel.INSTRUMENTS.FLITECAM, 0, 1, "Flux", "Wave", "jy", "");


        //GREAT, FIFILS... more complicated.

        private final int idxXaxis, idxYaxis;

        private final String xLabel, yLabel, xunit, yunit;
        private final SofiaSpectraModel.INSTRUMENTS instrument;

        SpectraInstrument(SofiaSpectraModel.INSTRUMENTS inst, int fitsRowIndexXaxis, int fitsRowIndexYaxis, String defaultXaxisLabel, String defaultYaxisLabel, String defaultXUnit, String defaultYUnit) {
            this.idxXaxis = fitsRowIndexXaxis;
            this.idxYaxis = fitsRowIndexYaxis;
            this.xLabel = defaultXaxisLabel;
            this.yLabel = defaultYaxisLabel;
            this.xunit = defaultXUnit;
            this.yunit = defaultYUnit;
            this.instrument = inst;
        }
    }

    private static class SofiaSpectra extends Spectra1D {
        Axis yaxis;
        Axis xaxis;

        SofiaSpectra(Axis x, Axis y) {
            this.xaxis = x;
            this.yaxis = y;
        }

        @Override
        public double[] getYAxis() {
            return this.yaxis.getAxis();
        }

        @Override
        public double[] getXAxis() {
            return this.xaxis.getAxis();
        }

        static class Axis {

            double[] axis;
            String unit;
            double[] error;

            String toUCD() {
                return "";
            }

            String desc() {
                return "-";
            }

            Axis(double[] vals, String u) {
                this.axis = vals;
                this.unit = u;
            }


            public double[] getAxis() {
                return axis;
            }

            public void setErrorAxis(double[] e) {
                this.error = e;
            }

            public double[] getError() {
                return error;
            }

            public void setAxis(double[] axis) {
                this.axis = axis;
            }

            public String getUnit() {
                return unit;
            }

            public void setUnit(String unit) {
                this.unit = unit;
            }

        }


    }


    public static FileInfo exportDg(DataGroup dg) throws IOException {
        File file = File.createTempFile("sofia-1dspectra", ".xml", ServerContext.getTempWorkDir());
        OutputStream out = new FileOutputStream(file, false);
        dataGroup2VOTable(dg, out);
        return new FileInfo(file);
    }
    public static void dataGroup2VOTable(DataGroup dg, OutputStream out) throws IOException {
        VoTableWriter.save(out, dg, VO_TABLE_TABLEDATA);
    }

    public static void main(String[] args) throws Exception {
        String url = "https://irsa.ipac.caltech.edu:443/data/SOFIA/FORCAST/OC5K/20170926_F433/proc/p4792/data/g2/F0433_FO_GRI_9000644_FORG063_RSP_0105.fits";
        File tempFile = File.createTempFile("Sofia1DSpectraExtractor-", ".fits");
        FileInfo file = URLDownload.getDataToFile(new URL(url), tempFile);
        tempFile.deleteOnExit();
//        FileAnalysis.Report analyze = FitsHDUUtil.analyze(file.getFile(), FileAnalysis.ReportType.Details);
//        BasicHDU[] parts = new Fits(file.getFile()).read();

        DataGroup headerDg = FitsHDUUtil.fitsHeaderToDataGroup(tempFile.getAbsolutePath());

//        SofiaSpectra s = extract1DSpectra(file.getFile());
        DataGroup dataObjects = extract1DSpectra(file.getFile(), new SofiaSpectraModel());

//        Iterator<DataObject> iterator = dataObjects.iterator();
//        while(iterator.hasNext()){
//            DataObject next = iterator.next();
//            Object[] data = next.getData();
//            for (int i = 0; i < data.length ; i++) {
//                System.out.println(data[i].toString());
//            }
//        }
        File tempSpectraFile = File.createTempFile("Sofia1DSpectraExtractor-", ".xml");
        VoTableWriter.save(tempSpectraFile, dataObjects, VO_TABLE_TABLEDATA);
        System.out.println("Wrote VOTable xml here:" + tempSpectraFile.getAbsolutePath());
//        int axis[] = new int[]{0, 0};
//        String xunit, yunit;
//        double[] flux, wave;
//        for (BasicHDU p : parts) {
//            System.out.println(p.getHeader());
//            xunit = p.getHeader().getStringValue("XUNIT");
//            axis[0] = p.getHeader().getIntValue("NAXIS1");
//            axis[1] = p.getHeader().getIntValue("NAXIS2");
//            xunit = p.getHeader().getStringValue("XUNIT");
//            yunit = p.getHeader().getStringValue("YUNIT");
//            double[][] fdata = (double[][]) p.getKernel();
//            flux = fdata[0];
//            wave = fdata[1];
//            s = SofiaSpectra.makeSpectra(fdata, new String[]{xunit, yunit});
//        }


//        BasicHDU[] parts = new Fits(file.getFile()).read();
//
//        FitsHDUUtil.fitsHeaderToDataGroup(file.getFile());

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
