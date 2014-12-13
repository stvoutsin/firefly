package edu.caltech.ipac.visualize.net;

import edu.caltech.ipac.util.Assert;

public class IrsaImageParams extends BaseIrsaParams  {

    public enum IrsaTypes { ISSA, TWOMASS, TWOMASS6, IRIS, MSX };

    private String _band= "12";
    private float  _size= 5.0F;
    private IrsaTypes _type= IrsaTypes.ISSA;

    public IrsaImageParams() { }

    public void setType(IrsaTypes type) { _type= type; }
    public IrsaTypes getType()          { return _type; }
    public void   setBand(String b)     { _band= b; }
    public void   setSize(float s)      { _size= s; }
    public String getBand()             { return _band; }
    public float  getSize()             { return _size; }

    public String getUniqueString() {
         String retval= null;
         switch (_type) {
             case ISSA :
                       retval= "Issa-" + super.toString() + _band + _size;
                       break;
             case TWOMASS :
                       retval= "2mass-" + super.toString() + _band + _size;
                       break;
             case MSX :
                       retval= "msx-" + super.toString() + _band + _size;
                       break;
             case IRIS :
                       retval= "iris-" + super.toString() + _band + _size;
                       break;
             default :
                 Assert.tst(false); break;
         }
         return retval;
    }

    public String toString() { return getUniqueString(); }
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