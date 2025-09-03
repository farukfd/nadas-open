#!/usr/bin/env python3
"""
Expo Router SPA Server with proper routing
"""
import http.server
import socketserver
import os
from urllib.parse import urlparse

class ExpoRouterHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL path
        parsed_path = urlparse(self.path)
        path = parsed_path.path.strip('/')
        
        # Remove query parameters for file checking
        clean_path = path.split('?')[0] if '?' in path else path
        
        print(f"Requested path: '{clean_path}'")
        
        # If it's a static asset (has extension), serve it normally
        if '.' in clean_path.split('/')[-1]:
            return super().do_GET()
        
        # Handle root path
        if clean_path == '':
            self.path = '/index.html'
            return super().do_GET()
        
        # Route mappings for Expo Router
        route_mappings = {
            'admin': 'admin.html',
            'login': 'login.html',
            'register': 'register.html', 
            'profile': 'profile.html',
            'query': 'query.html',
            'map': 'map.html',
            'notifications': 'notifications.html',
            'phone-verification': 'phone-verification.html'
        }
        
        # Check if the route exists in our mapping
        if clean_path in route_mappings:
            html_file = route_mappings[clean_path]
            if os.path.exists(html_file):
                print(f"Routing '{clean_path}' to '{html_file}'")
                self.path = '/' + html_file
                return super().do_GET()
        
        # Handle dynamic routes (like detail/[id])
        if clean_path.startswith('detail/'):
            detail_file = 'detail/[id].html'
            if os.path.exists(detail_file):
                print(f"Routing dynamic route '{clean_path}' to '{detail_file}'")
                self.path = '/' + detail_file
                return super().do_GET()
        
        # For any other route, serve the index.html (client-side routing will handle it)
        print(f"Fallback: routing '{clean_path}' to index.html")
        self.path = '/index.html'
        return super().do_GET()

def run_spa_server(port=3000, directory="dist"):
    """Run the Expo SPA server with proper routing"""
    original_dir = os.getcwd()
    os.chdir(directory)
    
    print(f"🚀 Expo SPA Server starting on port {port}")
    print(f"📁 Serving directory: {os.getcwd()}")
    print(f"📄 Available files: {sorted([f for f in os.listdir('.') if f.endswith('.html')])}")
    
    try:
        with socketserver.TCPServer(("", port), ExpoRouterHandler) as httpd:
            print(f"✅ Server running on http://localhost:{port}")
            print("🔗 Routes:")
            print(f"   http://localhost:{port}/")
            print(f"   http://localhost:{port}/admin")
            print(f"   http://localhost:{port}/login")
            print(f"   http://localhost:{port}/profile")
            print("Press Ctrl+C to stop")
            
            httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    finally:
        os.chdir(original_dir)

if __name__ == "__main__":
    run_spa_server()