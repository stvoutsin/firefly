/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.table.io;

import edu.caltech.ipac.firefly.core.FileAnalysisReport;
import edu.caltech.ipac.table.IpacTableDef;
import edu.caltech.ipac.table.TableUtil;
import edu.caltech.ipac.table.DataGroup;
import edu.caltech.ipac.table.DataObject;
import edu.caltech.ipac.table.DataType;
import edu.caltech.ipac.table.IpacTableUtil;
import edu.caltech.ipac.util.StringUtils;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;

import java.io.*;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;

/**
 * This is a utility class used to read/write Delimiter-separated values(DSV)
 * file into/from a DataGroup object.
 *
 * The CSV standard can be found here.  http://www.ietf.org/rfc/rfc4180.txt
 *
 * @author loi
 * @version $Id: DsvToDataGroup.java,v 1.2 2012/10/23 18:37:22 loi Exp $
 *
 * 09/28/17
 * LZ added another method in order to read file through an InputStream
 *
 */
public class DsvTableIO {

    public static DataGroup parse(InputStream inf, CSVFormat format) throws IOException {
        BufferedReader reader = new BufferedReader(new InputStreamReader(inf, "UTF-8"), IpacTableUtil.FILE_IO_BUFFER_SIZE);
        return getData(reader, format);
    }
    public static DataGroup parse(File inf, CSVFormat format) throws IOException {

        BufferedReader reader = new BufferedReader(new FileReader(inf), IpacTableUtil.FILE_IO_BUFFER_SIZE);
        return getData(reader, format);

    }


    private static DataGroup getData( BufferedReader reader, CSVFormat format)throws IOException{
        CSVParser parser = new CSVParser(reader, format);
        List<CSVRecord> records = parser.getRecords();
        if (records !=null && records.size() > 0) {

            // parse the column info
            CSVRecord cols = records.get(0);
            List<DataType> columns = convertToDataType(cols);
            DataGroup dg = new DataGroup(null, columns);
            TableUtil.ColCheckInfo colCheckInfo = new TableUtil.ColCheckInfo();

            // parse the data
            for (int i = 1; i < records.size(); i++) {
                DataObject row = parseRow(dg, records.get(i), colCheckInfo);
                if (row != null) {
                    dg.add(row);
                }
            }
            dg.trimToSize();
            return dg;
        }
        return null;
    }
    public static void write(File outf, DataGroup data) throws IOException {
        write(new FileWriter(outf), data, CSVFormat.DEFAULT);
    }

    public static void write(File outf, DataGroup data, CSVFormat format) throws IOException {
        write(new FileWriter(outf), data, format);
    }

    public static void write(Writer writer, DataGroup data, CSVFormat format) throws IOException {

        BufferedWriter outf = new BufferedWriter(writer, IpacTableUtil.FILE_IO_BUFFER_SIZE);
        try {
            CSVPrinter printer = new CSVPrinter(outf, format);

            if (data != null && data.size() > 0) {
                for (DataType t : data.getDataDefinitions()) {
                    printer.print(t.getKeyName());
                }
                printer.println();

                for (DataObject row : data.values()) {
                    for (String s : row.getFormattedData(true)) {
                        printer.print(s.trim());
                    }
                    printer.println();
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (outf != null) {
                outf.close();
            }
        }
    }

    private static List<DataType> convertToDataType(CSVRecord record) {
        List<DataType> columns = new ArrayList<DataType>();
        for(Iterator<String> itr = record.iterator(); itr.hasNext(); ) {
            String s = itr.next();
            if ("\uFEFF".charAt(0) == s.toCharArray()[0]){
                s = s.substring(1);//LZ fixed the issue with the BOM character
            }
            if (!StringUtils.isEmpty(s)) {
                columns.add(new DataType(s, null)); // unknown type
            }
        }
        return columns;
    }

    static DataObject parseRow(DataGroup source, CSVRecord line, TableUtil.ColCheckInfo colCheckInfo) {

        DataType[] headers = source.getDataDefinitions();
        if (line != null && line.size() > 0) {
            DataObject row = new DataObject(source);
            String val;
                for (int i = 0; i < headers.length; i++) {
                    DataType type = headers[i];
                    val = StringUtils.isEmpty(line.get(i)) ? null : line.get(i).trim();
                    if (!type.isKnownType()) {
                        IpacTableUtil.guessDataType(type,val);
                    }
                    row.setDataElement(type, type.convertStringToData(val));

                    TableUtil.CheckInfo checkInfo = colCheckInfo.getCheckInfo(type.getKeyName());
                    IpacTableUtil.applyGuessLogic(type, val, checkInfo);
                }
            return row;
        }
        return null;
    }

    private static DataGroup getHeader(File infile, CSVFormat format)throws IOException{
        BufferedReader reader = new BufferedReader(new FileReader(infile), IpacTableUtil.FILE_IO_BUFFER_SIZE);
        try {
            reader.mark(IpacTableUtil.FILE_IO_BUFFER_SIZE);
            CSVParser parser = new CSVParser(reader, format);
            List<DataType> columns = convertToDataType(parser.iterator().next()); // read just the first line.
            DataGroup dg = new DataGroup(null, columns);
            reader.reset();
            int lines = -1;             // don't count the header
            while (reader.readLine() != null) lines++;      // get line count
            dg.setSize(lines);
            return dg;
        } finally {
            reader.close();
        }
    }

    public static FileAnalysisReport analyze(File infile, CSVFormat csvFormat, FileAnalysisReport.ReportType type) throws IOException {
        DataGroup header = getHeader(infile, csvFormat);
        String format = (csvFormat == CSVFormat.TDF) ? TableUtil.Format.TSV.name() : TableUtil.Format.CSV.name();
        FileAnalysisReport report = new FileAnalysisReport(type, format, infile.length(), infile.getPath());
        FileAnalysisReport.Part part = new FileAnalysisReport.Part(FileAnalysisReport.Type.Table, String.format("%s (%d cols x %s rows)", csvFormat.getClass().getSimpleName(), header.getDataDefinitions().length, header.size()));
        part.setTotalTableRows(header.size());
        report.addPart(part);
        if (type.equals(FileAnalysisReport.ReportType.Details)) {
            IpacTableDef meta = new IpacTableDef();
            meta.setCols(Arrays.asList(header.getDataDefinitions()));
            part.setDetails(TableUtil.getDetails(0, meta));
        }
        return report;
    }

    public static void main(String[] args) {

        try {
            File inf = new File(args[0]);
            DataGroup dg = parse(inf, CSVFormat.DEFAULT);
            write(new File(inf.getAbsolutePath() + ".csv"), dg);
            write(new File(inf.getAbsolutePath() + ".tsv"), dg, CSVFormat.TDF);
        } catch (Exception e) {
            e.printStackTrace();
        }

    }

}
