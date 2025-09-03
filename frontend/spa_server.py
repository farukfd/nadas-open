#!/usr/bin/env python3
"""
Simple SPA (Single Page Application) HTTP Server
Handles client-side routing for Expo apps
"""
import http.server
import socketserver
import os
from urllib.parse import urlparse

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        # Parse the URL
        parsed_path = urlparse(self.path)
        path = parsed_path.path.strip('/')
        
        # Remove query parameters for file checking
        clean_path = path.split('?')[0] if '?' in path else path
        
        # If it's a static file (has extension), serve it normally
        if '.' in clean_path.split('/')[-1]:
            return super().do_GET()
        
        # Define route mappings
        route_mappings = {
            '': 'index.html',
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
            # Rewrite the path to the corresponding HTML file
            self.path = '/' + route_mappings[clean_path]
            return super().do_GET()
        
        # Handle dynamic routes (like /detail/[id])
        if clean_path.startswith('detail/'):
            # Serve the detail/[id].html file
            detail_file = 'detail/[id].html'
            if os.path.exists(os.path.join(self.directory, detail_file)):
                self.path = '/' + detail_file
                return super().do_GET()
        
        # If no mapping found, serve 404
        self.send_error(404, f"Route not found: {path}")

def run_server(port=3000, directory="dist"):
    """Run the SPA server"""
    os.chdir(directory)
    
    with socketserver.TCPServer(("", port), SPAHandler) as httpd:
        print(f"🚀 SPA Server running on http://localhost:{port}")
        print(f"📁 Serving directory: {os.getcwd()}")
        print(f"🔗 Routes available:")
        print(f"   http://localhost:{port}/")
        print(f"   http://localhost:{port}/admin")
        print(f"   http://localhost:{port}/login")
        print(f"   http://localhost:{port}/profile")
        print("Press Ctrl+C to stop")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n👋 Server stopped")

if __name__ == "__main__":
    run_server()