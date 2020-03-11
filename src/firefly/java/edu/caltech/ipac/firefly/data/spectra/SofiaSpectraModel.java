package edu.caltech.ipac.firefly.data.spectra;

import edu.caltech.ipac.table.DataType;

import java.util.HashMap;
import java.util.Map;

/**
 * Define SOFIA spectra model in terms of VO fields
 */
public class SofiaSpectraModel implements VOSpectraModel {

    public static VOSpectraModel getModel(){
        return null;
    }

    private final Map<String, DataType> voCols;
    private final SPECTRA_FIELDS[] spectraCols;

    public SofiaSpectraModel() {
        spectraCols = new VOSpectraModel.SPECTRA_FIELDS[]{VOSpectraModel.SPECTRA_FIELDS.FLUX, VOSpectraModel.SPECTRA_FIELDS.WAVELENGTH}; // make an enum SPECTRA_COLS("Flux",unit,ucd,type)..?

        voCols = new HashMap<>();
        for (SPECTRA_FIELDS param : spectraCols) {
            DataType dt = new DataType(param.getKey(), param.getTitle(), param.getMetaClass());
            dt.setDesc(param.getDescription());
            dt.setUnits(param.getUnits());
            dt.setUCD(param.getUcd());
            dt.setUType(param.getUtype());
//            dt.setWidth();
//            dt.setPrecision();
            voCols.put(param.getKey(), dt);
        }
    }

    @Override
    public Map<String, DataType> getMeta() {
        return voCols;
    }

    @Override
    public void setUnits(SPECTRA_FIELDS field, String units) {
        voCols.get(field.getKey()).setUnits(units);
    }

    @Override
    public void setUcd(SPECTRA_FIELDS field, String ucd) {
        voCols.get(field.getKey()).setUCD(ucd);
    }
    /*
    VOTable Example from NED:
    <VOTABLE version="v1.0">
    <RESOURCE utype="sed:SED">
        <TABLE name="./DATA/NGC_3034:S:HI:r1980_votable.xml" utype="sed:Segment">
        <GROUP utype="sed:Segment.SpectralCoord">
            <FIELDref ref="Frequency"/>
        </GROUP>
        <GROUP utype="sed:Segment.Flux">
            <FIELDref ref="Flux"/>
        </GROUP>
        <FIELD ID="Frequency" unit="Hz" datatype="double" name="Frequency" utype="sed:Segment.Points.SpectralCoord.Value"/>
        <FIELD ID="Flux" unit="W/m^2/Hz" datatype="double" name="Flux" utype="sed:Segment.Points.Flux.Value"/>
     */

    public enum INSTRUMENTS {
        GREAT("GREAT"),
        FORCAST("FORCAST",
                new HashMap<String, String>(){{put("IMAGING","IMAGING");}},
                new HashMap<String, String>(){{put("SW","SW"); put("LW","LW");}}
        ),
        FIFILS("FIFI-LS"),
        HAWC("HAWC_PLUS"),
        EXES("EXES"),
        FLITECAM("FLITECAM"),
        FPI("FPI_PLUS");

        private String name;
        private Map<String, String> config;
        private Map<String, String> camera;

        INSTRUMENTS(String name){
            this(name, null, null);
        }
        INSTRUMENTS(String name, Map<String, String> config){
            this(name, config, null);
        }
        INSTRUMENTS(String name, Map<String, String> config, Map<String, String> camera) {
            this.name =name;
            this.config = config;
            this.camera = camera;
        }

        public String getName(){return this.name;}
        public Map<String, String> getConfig(){return this.config;}
        public Map<String, String> getCamera(){return this.camera;}

    }

}
