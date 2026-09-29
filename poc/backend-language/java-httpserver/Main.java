// POC — the same /about.json contract as the real NestJS backend, in plain Java (JDK's
// own com.sun.net.httpserver, zero external dependencies — no Maven/Gradle project needed,
// runs with a single `java Main.java`, Java 11+'s single-file source launch).
//
// Tests exactly what the decision matrix in ARCHITECTURE.md scored for "Node.js" vs "Java":
// declaring a route, shaping a nested JSON response, reading the caller's IP, and how much
// ceremony (types, boilerplate) it takes to get there.
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;

public class Main {
    public static void main(String[] args) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress(5002), 0);
        server.createContext("/about.json", exchange -> {
            String host = exchange.getRemoteAddress().getAddress().getHostAddress();
            long now = System.currentTimeMillis() / 1000;
            // Hand-built JSON string: the JDK ships no JSON library. A real Java service
            // would add Jackson/Gson here — itself a dependency decision Node doesn't need
            // (JSON.stringify is a language builtin), which is the point of this POC.
            String json = "{\"client\":{\"host\":\"" + host + "\"},\"server\":{\"current_time\":" + now
                + ",\"services\":[{\"name\":\"rss\",\"widgets\":[{\"name\":\"article_list\","
                + "\"description\":\"Display the last items from a given feed\","
                + "\"params\":[{\"name\":\"link\",\"type\":\"string\"},{\"name\":\"number\",\"type\":\"integer\"}]}]}]}}";
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        });
        server.start();
        System.out.println("Listening on :5002");
    }
}
