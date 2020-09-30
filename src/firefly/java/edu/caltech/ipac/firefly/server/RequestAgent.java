/*
 * License information at https://github.com/Caltech-IPAC/firefly/blob/master/License.txt
 */
package edu.caltech.ipac.firefly.server;

import edu.caltech.ipac.firefly.data.userdata.UserInfo;
import edu.caltech.ipac.firefly.server.security.JOSSOAdapter;
import edu.caltech.ipac.firefly.server.util.Logger;
import edu.caltech.ipac.util.StringUtils;

import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Date: 4/20/15
 * This class acts as an agent for the underlaying request.  A request can initiate from different sources.
 * In this case, it can be HTTP, WS, or POJO.
 *
 * It also handle authentication related functions
 *
 * @author loi
 * @version $Id: $
 */
public class RequestAgent {

    private Map<String, String> cookies;
    private String protocol;
    private String host;
    private String requestUrl;
    private String baseUrl;
    private String remoteIP;
    private String sessId;
    private String contextPath;

    public RequestAgent() {}

    public RequestAgent(Map<String, String> cookies, String protocol, String requestUrl, String baseUrl, String remoteIP, String sessId, String contextPath) {
        this.cookies = cookies;
        this.protocol = protocol;
        this.requestUrl = requestUrl;
        this.baseUrl = baseUrl;
        this.remoteIP = remoteIP;
        this.sessId = sessId;
        this.contextPath = contextPath;
    }

    public void setCookies(Map<String, String> cookies) {
        this.cookies = cookies;
    }

    public Map<String, String> getCookies() {
        if (cookies == null) {
            cookies = extractCookies();
        }
        return cookies;
    }

    public String getSessId() {
        return sessId;
    }

    void setSessId(String sessId) {
        this.sessId = sessId;
    }

    String getContextPath() { return contextPath; }
    void setContextPath(String contextPath) { this.contextPath = contextPath; };

    public String getProtocol() {
        return protocol;
    }

    void setProtocol(String protocol) {
        this.protocol = protocol;
    }

    public String getHost() { return host;}

    public void setHost(String host) { this.host = host;}

    public String getRequestUrl() {
        return requestUrl;
    }

    void setRequestUrl(String requestUrl) {
        this.requestUrl = requestUrl;
    }

    public String getBaseUrl() { return baseUrl; }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    String getRemoteIP() {
        return remoteIP;
    }

    void setRemoteIP(String remoteIP) {
        this.remoteIP = remoteIP;
    }

    public void sendCookie(Cookie cookie) {}

    String getCookie(String name) {
        return getCookies().get(name);
    }

    public String getRealPath(String relPath) {
        return null;
    }

    public String getHeader(String name) {
        return getHeader(name, null);
    }

    public String getHeader(String name, String def) {
        return null;
    }

    public void sendRedirect(String url) {}

    protected Map<String, String> extractCookies() {
        return new HashMap<>(0);
    }


    //====================================================================
    //  Authentication section
    //====================================================================
    public String getAuthKey() { return null; }
    public String getAuthToken() { return null;}
    public UserInfo getUserInfo() { return null; }
    public void clearAuthInfo() {}
    public Map<String, String> getIdentities() { return null; }
    public void updateAuthInfo(String authToken) {}


//====================================================================
//  RequestAgent implementations...
//====================================================================

    public static class HTTP extends RequestAgent {
        public static String AUTH_KEY = "JOSSO_SESSIONID";
        public static String TO_BE_DELETE = "-";
        private static final Logger.LoggerImpl LOG = Logger.getLogger();
        private HttpServletRequest request;
        private HttpServletResponse response;
        private static final String[] ID_COOKIE_NAMES = new String[]{AUTH_KEY, "ISIS"};

        public HTTP(HttpServletRequest request, HttpServletResponse response) {
            this.request = request;
            this.response = response;

            // getting the correct info behind a reverse proxy or load balancer that terminates the SSL is a bit tricky
            // because the requests are forwarded to the servlet container as plain http with some of the header modified
            // attempt to reconstruct what the original request url component should be
            // proto://host:port/uri?queryString

            String remoteIP = getHeader("X-Forwarded-For", request.getRemoteAddr());
            String proto = getHeader("X-Forwarded-Proto", request.getScheme());
            String host = getHeader("X-Forwarded-Host", request.getServerName());
            String serverPort = getHeader("X-Forwarded-Port", String.valueOf(request.getServerPort()));
            serverPort = serverPort.equals("80") || serverPort.equals("443") ? "" : ":" + serverPort;
            String contextPath = getPath(request);
            String uri =  getHeader("X-Original-URI", request.getRequestURI());

            String baseUrl = String.format("%s://%s%s%s/", proto, host, serverPort, contextPath);
            String requestUrl = String.format("%s://%s%s%s", proto, host, serverPort, uri);

            setContextPath(contextPath);
            setRemoteIP(remoteIP);
            setProtocol(proto);
            setHost(host);
            setRequestUrl(requestUrl);
            setBaseUrl(baseUrl);
            setSessId(request.getSession(true).getId());
        }

        @Override
        protected Map<String, String> extractCookies() {
            HashMap<String, String> cookies = new HashMap<>();
            if (request != null) {
                if (request.getCookies() != null) {
                    for (javax.servlet.http.Cookie c : request.getCookies()) {
                        cookies.put(c.getName(), c.getValue());
                    }
                }
            }
            return cookies;
        }

        @Override
        public String getRealPath(String relPath) {
            return response != null ? request.getRealPath(relPath) : null;
        }

        @Override
        public void sendCookie(Cookie cookie) {
            if (response != null) {
                response.addCookie(cookie);
            }
        }

        @Override
        public String getHeader(String name, String def) {
            if (request != null) {
                String retval = request.getHeader(name);
                retval = retval == null ? request.getHeader(name.toLowerCase()) : retval;
            return StringUtils.isEmpty(retval) ? def : retval;
            } else {
                return def;
            }
        }

        /**
         * Finding the "context" path behind a reverse proxy is very tricky.
         * For that reason, if it's proxied to a path that does not end with the same context as the app server,
         * then the header X-Forwarded-Path has to define what that value is.
         * Otherwise, it will try to resolve is using the header X-Original-URI.
         * If both are missing, it will assume the context is the same as what's deployed on the app server
         */
        private String getPath(HttpServletRequest request) {
            String path = request.getHeader("X-Forwarded-Path");
            if (path == null) {
                path = request.getHeader("X-Original-URI");
                if (path != null) {
                    path = path.substring(0, path.indexOf(request.getContextPath()) + request.getContextPath().length());
                }
            }
            if (path == null) {
                path = request.getContextPath();
            }
            return path;
        }


        @Override
        public void sendRedirect(String url) {
            try {
                response.sendRedirect(url);
            } catch (IOException e) {
                LOG.error(e, "Unable to redirect to:" + url);
            }
        }

        //====================================================================
        //  Authentication section
        //====================================================================

        @Override
        public String getAuthKey() {
            return AUTH_KEY;
        }

        @Override
        public Map<String, String> getIdentities() {
            HashMap<String, String> idCookies = new HashMap<String, String>();
            for (String name : ID_COOKIE_NAMES) {
                String value = getCookie(name);
                if (!StringUtils.isEmpty(value)) {
                    idCookies.put(name, value);
                }
            }
            return idCookies.size() == 0 ? null : idCookies;
        }

        @Override
        public UserInfo getUserInfo() {
            String authToken = getAuthToken();
            return StringUtils.isEmpty(authToken) ? null :
                    JOSSOAdapter.getUserInfo(authToken);
        }

        @Override
        public String getAuthToken() {
            return getCookie(AUTH_KEY);
        }

        @Override
        public void updateAuthInfo(String authToken) {
            Cookie c = new Cookie(AUTH_KEY, authToken);
            c.setMaxAge(authToken == null ? 0 : 60 * 60 * 24 * 14);
            c.setValue(authToken);
            c.setPath("/");
            sendCookie(c);

        }

        @Override
        public void clearAuthInfo() {
            if (getAuthToken() != null) {
                Cookie c = new Cookie(AUTH_KEY, "");
                c.setMaxAge(0);
                c.setValue(TO_BE_DELETE);
                c.setDomain("ipac.caltech.edu");
                c.setPath("/");
                sendCookie(c);
            }
        }
    }
}
