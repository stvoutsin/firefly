/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server.visualize;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.firefly.data.RelatedData;
import edu.caltech.ipac.firefly.visualize.Band;
import edu.caltech.ipac.visualize.plot.plotdata.FitsRead;

import java.io.File;
import java.util.List;

/**
* @author Trey Roby
*/
class FileReadInfo {

    private final Band band;
    private final File originalFile; // the original file name
    private final File workingFile;  //  the version of the original file without any .zip on it, used as base name for _workingFile
    private final int originalImageIdx;
    private final FitsRead fr;
    private final String dataDesc;
    private final ModFileWriter modFileWriter;
    private final List<RelatedData> relatedData;
    private final String uploadedName;
    private final FileInfo fi;

    FileReadInfo(File originalFile,
                 FitsRead fr,
                 FileInfo fi,
                 Band band,
                 int imageIdx,
                 String dataDesc,
                 String uploadedName,
                 List<RelatedData> relatedData,
                 ModFileWriter modFileWriter) {
        this.originalFile= originalFile;
        this.workingFile = originalFile;
        this.band= band;
        this.originalImageIdx= imageIdx;
        this.fr= fr;
        this.fi= fi;
        this.modFileWriter= modFileWriter;
        this.dataDesc= dataDesc;
        this.relatedData= relatedData;
        this.uploadedName= uploadedName;
    }

    public Band getBand() { return band; }
    public File getOriginalFile() { return originalFile; }
    public File getWorkingFile() { return workingFile; }
    public int getOriginalImageIdx() { return originalImageIdx; }
    public FitsRead getFitsRead() { return fr; }
    public String getDataDesc() { return dataDesc; }
    public ModFileWriter getModFileWriter() { return modFileWriter; }
    public String getUploadedName() {return uploadedName;}
    public List<RelatedData> getRelatedData() {return relatedData;}
    public FileInfo getFileInfo() { return fi; }
}
