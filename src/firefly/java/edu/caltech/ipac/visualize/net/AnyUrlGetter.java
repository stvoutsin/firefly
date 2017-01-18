/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.visualize.net;

import edu.caltech.ipac.firefly.data.FileInfo;
import edu.caltech.ipac.util.ClientLog;
import edu.caltech.ipac.util.download.DownloadListener;
import edu.caltech.ipac.util.download.FailedRequestException;
import edu.caltech.ipac.util.download.URLDownload;

import java.io.EOFException;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.net.MalformedURLException;
import java.net.URL;


/**
 * This class gets any url object
 **/
public class AnyUrlGetter {


  public static FileInfo lowlevelGetUrlToFile(AnyUrlParams     params,
                                              File             outfile,
                                              boolean          useSuggestedFilename,
                                              DownloadListener dl) throws FailedRequestException {

      FileInfo outFiles;
      try {
          outFiles=URLDownload.getDataToFile(params.getURL(), outfile, params.getCookies(), null,
                                             dl, useSuggestedFilename,true,
                                             params.getMaxSizeToDownload());
      } catch (MalformedURLException me) {
          ClientLog.warning(me.toString());
          throw new FailedRequestException(FailedRequestException.SERVICE_FAILED,
                           "Details in exception", me);
      } catch (FileNotFoundException fne) {
          throw new FailedRequestException("Could not find file",
                                           "URL not found: " + params.getURL() , fne);
      } catch (IOException ioe) {
          if(ioe.getCause() instanceof EOFException) {
              throw new FailedRequestException("Could not find any data for this URL",
                                  "No data could be downloaded from this URL\n"+
                                  params.getURL().toString());
          }
          else {
              throw new FailedRequestException("IO problem",
                                               "Details in exception", ioe);
          }
      }
      return outFiles;
  }

	
   public static void main(String args[]) {
       String urlStr;
       URL url;
       AnyUrlParams p;
       try {
           try {System.in.read(); } catch (IOException e) {/*ignore*/}
             urlStr=  "http://localhost:12201/"+
                    "ArchiveDownload/download?EPPreviewH&id=1106";
           url= new URL(urlStr);
           p= new AnyUrlParams(url);
           lowlevelGetUrlToFile(p,new File("single.dat"),true, null);
       } catch (FailedRequestException e) {
           System.out.print(e.toString());
       } catch (MalformedURLException e) {
           System.out.print(e.toString());
       }
   }

}
