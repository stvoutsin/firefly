/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.ui.panels.user;


import com.google.gwt.event.dom.client.ClickEvent;
import com.google.gwt.event.dom.client.ClickHandler;
import com.google.gwt.user.client.Command;
import com.google.gwt.user.client.DeferredCommand;
import com.google.gwt.user.client.ui.*;
import edu.caltech.ipac.firefly.ui.Form;
import edu.caltech.ipac.firefly.ui.FormBuilder;
import edu.caltech.ipac.firefly.ui.GwtUtil;
import edu.caltech.ipac.firefly.ui.input.InputField;

import java.util.EventListener;


/**
 *
 * @author tatianag
 * @version $Id: LoginPanel.java,v 1.12 2012/09/13 22:15:11 loi Exp $
 */
public class LoginPanel extends Composite {

    public static final String USERNAME_KEY="SignIn.field.username";
    public static final String PASSWORD_KEY="SignIn.field.pass";
    public static final String EMAIL_KEY="SignIn.field.email";

    Form inputForm;  // to sign up
    Form inputFormR; // to restore login info

    InputField username;
    InputField password;
    HTML status = new HTML("");

    DeckPanel panel = new DeckPanel();
    VerticalPanel vpanel = new VerticalPanel();


    /**
     * Create a new Login Panel.
     *
     * @param loginListener the callback to be notifed of a login attempt.
     */
    public LoginPanel(final LoginListener loginListener) {
        initWidget(vpanel);

        Widget fp = FormBuilder.createPanel(100, USERNAME_KEY, PASSWORD_KEY);


        final LoginPanel lp = this;
        inputForm = new Form();
        inputForm.setHelpId("user.signin");
        inputForm.add(fp);
        inputForm.addSubmitButton(GwtUtil.makeFormButton("Login",
                new ClickHandler(){
                    public void onClick(ClickEvent event) {
                        resetStatus();
                        if (inputForm.validate()) {
                            loginListener.onSignIn(lp);
                        }
                    }
                }));
        inputForm.addButton(GwtUtil.makeFormButton("Cancel",new ClickHandler(){
                    public void onClick(ClickEvent event) {
                        resetStatus();
                        loginListener.onCancel(lp);
                    }
                }));


        // restore user info panel
        Widget fpR = FormBuilder.createPanel(50, EMAIL_KEY);

        inputFormR = new Form();
        inputFormR.setHelpId("user.retrieveinfo");
        inputFormR.add(fpR);
        inputFormR.addSubmitButton(GwtUtil.makeFormButton("Send My Info", new ClickHandler(){
                    public void onClick(ClickEvent event) {
                        resetStatus();
                        if (inputFormR.validate()) {
                            loginListener.onRetrieveInfo(lp);
                        }
                    }
                }));

        inputFormR.addButton(GwtUtil.makeFormButton("Cancel",
            new ClickHandler(){
                    public void onClick(ClickEvent event) {
                        resetStatus();
                        panel.showWidget(0);
                    }
                }));



        Widget signup= GwtUtil.makeLinkButton("Create an Account",
                                              "Click here to make a new login account",
                                              new ClickHandler() {
                                                  public void onClick(ClickEvent ev) {
                                                      loginListener.onNewAccount(lp);
                                                  }
                                              });

        Widget restore= GwtUtil.makeLinkButton("Forgot User Info?",
                                               "Click here to have you user name emailed to you",
                                               new ClickHandler() {
                                                   public void onClick(ClickEvent ev) {
                                                       resetStatus();
                                                       panel.showWidget(1);
                                                   }
                                               });
        Widget links = GwtUtil.leftRightAlign(new Widget[]{signup}, new Widget[]{restore});
        ((HorizontalPanel)links).setSpacing(10);
        VerticalPanel vp = new VerticalPanel();
        vp.add(inputForm);
        vp.add(links);

        panel.add(vp);
        panel.add(inputFormR);
        panel.setWidth("320px");
        panel.showWidget(0);

        status.addStyleName("user-status-text");
        vpanel.add(status);
        vpanel.add(panel);

        username = inputForm.getField(USERNAME_KEY);
        password = inputForm.getField(PASSWORD_KEY);
    }

    private void resetStatus() {
        status.setHTML("");
    }

    /**
     * Grab the focus. This will put the cursor in the text field for the user.
     */
    public void focus() {
        DeferredCommand.addCommand(new Command(){
            public void execute() {
                inputForm.setFocus(USERNAME_KEY);
            }
        });
    }



    /**
     * Reset the widget to the initial state.
     */
    public void reset() {
        username.setValue("");
        password.setValue("");
        panel.showWidget(0);
        resetStatus();
        focus();
    }


    /**
     * Get the entered username.
     *
     * @return the username currently entered.
     */
    public String getUsername() {
        return username.getValue();
    }

    /**
     * Get the entered password.
     *
     * @return the password currently entered.
     */
    public String getPassword() {
        return password.getValue();
    }

    /**
     * Get email
     * @return email
     */
    public String getEmail() {
        return inputFormR.getField(EMAIL_KEY).getValue();
    }

    /**
     * Set the message to display to the user.
     * @param message the message to display to the user.
     */
    public void setMessage(String message) {
        status.setHTML(message);

    }

    /**
     * Callback for a login attempt.
     */
    public static interface LoginListener extends EventListener {
        /**
         * Fired when the user tries to login.
         * This happens either when the user presses the submit button or presses the enter key.
         * @param loginPanel the origin of the event.
         */
        public void onSignIn(LoginPanel loginPanel);

        /**
         * Fired when the user presses "Send My Info" button
         * @param loginPanel the origin of the event
         */
        public void onRetrieveInfo(LoginPanel loginPanel);

        /**
         * Fired when user presses "Create New Account" link
         * @param loginPanel the origin of the event
         */
        public void onNewAccount(LoginPanel loginPanel);

        /**
         * Fired when the user presses the cancel button
         * @param loginPanel the origin of the event
         */
        public void onCancel(LoginPanel loginPanel);


    }

}
