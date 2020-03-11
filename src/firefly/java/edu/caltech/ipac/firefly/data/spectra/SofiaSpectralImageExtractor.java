package edu.caltech.ipac.firefly.data.spectra;

import edu.caltech.ipac.firefly.data.ServerRequest;
import edu.caltech.ipac.table.DataGroup;
import org.apache.commons.lang.NotImplementedException;

/**
 * FIF-LS FITS images header are not standard,
 * this class should convert header into well-suited FITS spectral image
 */
public class SofiaSpectralImageExtractor extends DataExtractUtil {
    @Override
    public DataGroup getDataGroup(ServerRequest req) throws Exception {
        throw new NotImplementedException("FIFI-LS FITS header converted to be implemented");
    }
}
