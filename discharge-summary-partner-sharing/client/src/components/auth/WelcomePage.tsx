import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MedicalHeader from './MedicalHeader';
import SimpleCarousel from './SimpleCarousel';

const WelcomePage = () => {
  const [carouselImages] = useState([
    {
      url: 'https://images.unsplash.com/photo-1551190822-a9333d879b1f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      title: 'Advanced Medical Care',
      description: 'State-of-the-art facilities with cutting-edge technology for comprehensive healthcare.',
      cta: 'Learn More'
    },
    {
      url: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      title: 'Expert Medical Team',
      description: 'Highly qualified specialists dedicated to providing exceptional patient care.',
      cta: 'Meet Our Doctors'
    },
    {
      url: 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      title: 'Digital Health Solutions',
      description: 'Streamlined discharge summaries and digital health records for better patient outcomes.',
      cta: 'Get Started'
    },
    {
      url: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80',
      title: 'Collaborative Healthcare',
      description: 'Our multidisciplinary team works together to ensure comprehensive patient care.',
      cta: 'Learn More'
    }
  ]);

  return (
    <div className="min-h-screen bg-white">
      <MedicalHeader />
      
      <section className="relative">
        <SimpleCarousel 
          images={carouselImages}
          autoSlideInterval={4000}
          className="h-[70vh] md:h-[80vh] lg:h-[85vh]"
        />
      </section>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
              Welcome to <span className="text-blue-600">MedCare Hospital</span>
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed mb-8">
              Your trusted partner in healthcare excellence, providing compassionate care with cutting-edge medical technology.
            </p>
            
            <div className="flex justify-center">
              <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-8 py-4 text-lg rounded-lg transition-colors duration-200">
                Sign In
              </Link>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">24/7 Emergency Care</h3>
            <p className="text-gray-600 text-sm">Round-the-clock emergency services with rapid response times.</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 overflow-hidden">
              <img 
                src="https://images.unsplash.com/photo-1582750433449-648ed127bb54?ixlib=rb-4.0.3&auto=format&fit=crop&w=64&h=64&q=80" 
                alt="Medical Team" 
                className="w-full h-full object-cover"
              />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Expert Medical Staff</h3>
            <p className="text-gray-600 text-sm">Highly qualified specialists and healthcare professionals.</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Digital Records</h3>
            <p className="text-gray-600 text-sm">Advanced digital health records and discharge summary system.</p>
          </div>
          
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Compassionate Care</h3>
            <p className="text-gray-600 text-sm">Patient-centered approach with personalized treatment plans.</p>
          </div>
        </div>
      </main>
      
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Excellence in Healthcare Since 1995
              </h2>
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                At MedCare Hospital, we are committed to providing exceptional healthcare services 
                with compassion, innovation, and excellence. Our state-of-the-art facilities and 
                dedicated medical professionals ensure that every patient receives the highest 
                quality care tailored to their individual needs.
              </p>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">99.8% Success Rate</p>
                    <p className="text-sm text-gray-500">Patient Satisfaction</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">50+ Specialists</p>
                    <p className="text-sm text-gray-500">Expert Medical Team</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="rounded-2xl overflow-hidden shadow-2xl">
                <img 
                  src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
                  alt="Medical professionals collaborating"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default WelcomePage;