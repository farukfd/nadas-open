#!/bin/bash

# EmlakEkspertizi.com Deployment Script
# Advanced Real Estate Index ML Platform

set -e  # Exit on any error

echo "🏢 EmlakEkspertizi.com Deployment Starting..."
echo "================================================="

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check Node.js (for frontend development)
    if ! command -v node &> /dev/null; then
        log_warning "Node.js is not installed. Frontend development may not work locally."
    fi
    
    # Check Python (for backend development)
    if ! command -v python3 &> /dev/null; then
        log_warning "Python 3 is not installed. Backend development may not work locally."
    fi
    
    log_success "Prerequisites check completed."
}

# Environment setup
setup_environment() {
    log_info "Setting up environment variables..."
    
    # Backend environment
    if [ ! -f "./backend/.env" ]; then
        log_info "Creating backend .env file..."
        cat > ./backend/.env << EOF
MONGO_URL=mongodb://admin:emlakadmin2025@mongodb:27017/emlak_endeksi?authSource=admin
DB_NAME=emlak_endeksi
JWT_SECRET=emlakekspertizi_jwt_secret_2025_$(date +%s)
DEBUG=false
ENVIRONMENT=production
EOF
        log_success "Backend .env file created."
    else
        log_info "Backend .env file already exists."
    fi
    
    # Frontend environment
    if [ ! -f "./frontend/.env" ]; then
        log_info "Creating frontend .env file..."
        cat > ./frontend/.env << EOF
EXPO_PUBLIC_BACKEND_URL=http://localhost:8001
EXPO_PACKAGER_HOSTNAME=localhost
EXPO_USE_FAST_RESOLVER=true
EOF
        log_success "Frontend .env file created."
    else
        log_info "Frontend .env file already exists."
    fi
}

# Build and start services
start_services() {
    log_info "Building and starting services with Docker Compose..."
    
    # Stop existing services
    docker-compose down --remove-orphans
    
    # Build and start services
    docker-compose up --build -d
    
    log_success "Services started successfully."
}

# Wait for services to be ready
wait_for_services() {
    log_info "Waiting for services to be ready..."
    
    # Wait for MongoDB
    log_info "Waiting for MongoDB..."
    while ! docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ismaster')" &> /dev/null; do
        sleep 2
    done
    log_success "MongoDB is ready."
    
    # Wait for Backend
    log_info "Waiting for Backend API..."
    while ! curl -f http://localhost:8001/api/health &> /dev/null; do
        sleep 2
    done
    log_success "Backend API is ready."
    
    # Wait for Frontend (optional)
    log_info "Checking Frontend..."
    sleep 5  # Give Expo some time to start
    log_success "Frontend should be available soon."
}

# Run initial data setup
setup_initial_data() {
    log_info "Setting up initial data..."
    
    # Run seed data script
    docker-compose exec backend python seed_data.py
    
    log_success "Initial data setup completed."
}

# Health check
health_check() {
    log_info "Running health checks..."
    
    # Backend health
    if curl -f http://localhost:8001/api/health &> /dev/null; then
        log_success "Backend health check passed."
    else
        log_error "Backend health check failed."
        return 1
    fi
    
    # Database health
    if docker-compose exec -T mongodb mongosh --eval "db.adminCommand('ismaster')" &> /dev/null; then
        log_success "Database health check passed."
    else
        log_error "Database health check failed."
        return 1
    fi
    
    log_success "All health checks passed."
}

# Display deployment information
show_deployment_info() {
    echo ""
    echo "🎉 Deployment Completed Successfully!"
    echo "================================================="
    echo ""
    echo "📊 Service URLs:"
    echo "  • Backend API:     http://localhost:8001"
    echo "  • API Documentation: http://localhost:8001/docs"
    echo "  • Frontend (Expo): http://localhost:3000"
    echo "  • MongoDB:         mongodb://localhost:27017"
    echo ""
    echo "🔐 Admin Credentials:"
    echo "  • Username: superadmin"
    echo "  • Password: emlakadmin2025"
    echo ""
    echo "📱 Admin Panel Features:"
    echo "  • 📊 Dashboard: System statistics and metrics"
    echo "  • 📊 Veri İşleme: Data loading and preprocessing"
    echo "  • 🤖 Model Eğitimi: ML model training and management"
    echo "  • ⏰ Backfill: Historical data prediction system"
    echo "  • 👥 Kullanıcılar: User management"
    echo "  • ⚙️ Ayarlar: System configuration"
    echo ""
    echo "🤖 ML Capabilities:"
    echo "  • Prophet (Time Series Forecasting)"
    echo "  • XGBoost (Gradient Boosting)"
    echo "  • Random Forest (Ensemble Learning)"
    echo "  • Linear/Ridge/Lasso Regression"
    echo ""
    echo "📊 Data Scale:"
    echo "  • Price Indices: 1,704,733+ records"
    echo "  • Users: 25,692+ (KVKV compliant)"
    echo "  • Real Estate Ads: 25+ active listings"
    echo "  • Backfill Predictions: Unlimited AI-generated data"
    echo ""
    echo "🚀 Next Steps:"
    echo "  1. Visit http://localhost:8001/docs for API documentation"
    echo "  2. Open Expo development tools at http://localhost:3000"
    echo "  3. Access admin panel at /admin route"
    echo "  4. Import real estate data using the admin panel"
    echo "  5. Train ML models for price prediction"
    echo "  6. Run backfill for historical data completion"
    echo ""
    echo "📚 Documentation:"
    echo "  • README: ./README_GITHUB.md"
    echo "  • License: ./LICENSE"
    echo "  • Docker Compose: ./docker-compose.yml"
    echo ""
    echo "🛠️ Management Commands:"
    echo "  • View logs:    docker-compose logs -f [service_name]"
    echo "  • Stop services: docker-compose down"
    echo "  • Restart:      docker-compose restart [service_name]"
    echo "  • Shell access: docker-compose exec [service_name] /bin/bash"
    echo ""
    echo "Built with ❤️ for the Turkish Real Estate Market"
    echo "© 2025 EmlakEkspertizi.com - Advanced Real Estate Analytics"
}

# Main deployment flow
main() {
    echo "🚀 Starting EmlakEkspertizi.com Deployment Process"
    echo ""
    
    check_prerequisites
    setup_environment
    start_services
    wait_for_services
    setup_initial_data
    health_check
    
    show_deployment_info
    
    log_success "Deployment completed successfully! 🎉"
}

# Handle script arguments
case "${1:-}" in
    "check")
        check_prerequisites
        ;;
    "env")
        setup_environment
        ;;
    "start")
        start_services
        wait_for_services
        ;;
    "health")
        health_check
        ;;
    "stop")
        log_info "Stopping services..."
        docker-compose down
        log_success "Services stopped."
        ;;
    "restart")
        log_info "Restarting services..."
        docker-compose restart
        log_success "Services restarted."
        ;;
    "logs")
        docker-compose logs -f
        ;;
    "clean")
        log_warning "This will remove all containers and volumes. Are you sure? (y/N)"
        read -r response
        if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
            docker-compose down -v --remove-orphans
            docker system prune -f
            log_success "Cleanup completed."
        else
            log_info "Cleanup cancelled."
        fi
        ;;
    *)
        main
        ;;
esac