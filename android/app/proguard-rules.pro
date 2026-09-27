# The bundled interface calls these annotated methods through Android WebView.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
