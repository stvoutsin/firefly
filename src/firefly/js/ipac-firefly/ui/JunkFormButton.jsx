/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */

"use strict";
var React= require('react/addons');
var Promise= require("es6-promise").Promise;
import FieldGroupActions from '../actions/FieldGroupActions.js';
import {defineDialog} from '../ui/DialogRootContainer.jsx';
import DialogActions from '../actions/DialogActions.js';
import PopupPanel from '../ui/PopupPanel.jsx';
import FieldGroupUtils from 'ipac-firefly/store/util/FieldGroupUtils.js';


var JunkFormButton = module.exports= React.createClass(
   {

       validUpdate(valid) {
           var statStr= "validate state: "+ valid;
           var request= FieldGroupUtils.getResults(this.props.groupKey);
           console.log(statStr);
           console.log(request);

           var s= Object.keys(request).reduce(function(buildString,k,idx,array){
               buildString+=k+"=" +request[k];
               if (idx<array.length-1) buildString+=', ';
               return buildString;
           },'');


           var resolver= null;
           var closePromise= new Promise(function(resolve, reject) {
               resolver= resolve;
           });

           var results= (
               <PopupPanel title={'Example Dialog'} closePromise={closePromise} >
                   {this.makeResultInfoContent(statStr,s,resolver)}
               </PopupPanel>
               );

           defineDialog('ResultsFromExampleDialog', results);
           DialogActions.showDialog({dialogId: 'ResultsFromExampleDialog'});
       },

       getInitialState : function() {
           this.validUpdate= this.validUpdate.bind(this);
           return { };
       },

       componentDidMount() {
           var {groupKey, fieldKey}= this.props;
           FieldGroupActions.mountComponent( {
               groupKey, fieldKey, mounted : true, value: true,
               fieldState: this.props.initialState
           } );
       },

       componentWillUnmount() {
           var {groupKey, fieldKey}= this.props;
           FieldGroupActions.mountComponent( {
               groupKey, fieldKey, mounted : false, value: true
           } );

       },


       onClick(ev) {
           FieldGroupUtils.validate(this.props.groupKey, this.validUpdate)
       },


       makeResultInfoContent(statStr,s,closePromiseClick) {
           return (
                   <div style={{padding:'5px'}}>
                       <br/>{statStr}<br/><br/>{s}
                       <button type="button" onClick={closePromiseClick}>Another Close</button>
                   </div>
                   );
       },

       render: function() {
           return (
                   <div>
                       <button type="button" onClick={this.onClick}>submit now</button>
                   </div>
           );
       }


   });

