package edu.caltech.ipac.firefly.data.spectra;

import edu.caltech.ipac.table.DataGroup;

/**
 * Should be defined... but encapsulate default definition of
 * Axis, type of chart, etc, any info from the data source of the spectra etxracted
 * that could be attached to the client for display purposes
 */
public abstract class Spectra1D {

    public DataGroup toDataGroup() {

        double[] x = getXAxis();
        double[] y = getYAxis();


        DataGroup dg = null;

        // ...
        return dg;

    }

//    public abstract Object getMeta();

    public abstract double[] getYAxis();

    public abstract double[] getXAxis();

}
