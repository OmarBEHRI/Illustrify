import React from 'react';

const testimonials = [
  {
    content: "Illustrify completely transformed how I create content for my YouTube channel. What used to take days now takes hours, and the quality is amazing.",
    author: "Alex Johnson",
    role: "Content Creator",
    avatar: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
  },
  {
    content: "As a marketing agency, we're always looking for ways to deliver more value to clients. Illustrify helps us create compelling video content at scale.",
    author: "Sarah Williams",
    role: "Marketing Director",
    avatar: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
  },
  {
    content: "The ability to quickly turn my blog posts into engaging videos has increased my audience engagement by over 200%. Game changer.",
    author: "Michael Chen",
    role: "Tech Blogger",
    avatar: "https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1"
  },
];

export const TestimonialSection: React.FC = () => {
  return (
    <section className="relative bg-black py-24 overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-purple-900/20 rounded-full blur-[100px]"></div>
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-pink-900/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">What Our Users Say</h2>
          <p className="max-w-2xl mx-auto text-lg text-gray-400">
            Join thousands of content creators transforming their work with Illustrify
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div 
              key={index}
              className="relative overflow-hidden rounded-xl border border-purple-900/30 bg-black/50 backdrop-blur-sm p-6 hover:border-purple-600/50 transition-all duration-300"
            >
              <div className="mb-6">
                {/* Stars */}
                <div className="flex mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                
                <p className="text-gray-300 italic">"{testimonial.content}"</p>
              </div>
              
              <div className="flex items-center">
                <img 
                  src={testimonial.avatar} 
                  alt={testimonial.author}
                  className="h-10 w-10 rounded-full object-cover mr-3"
                />
                <div>
                  <h4 className="text-white font-medium">{testimonial.author}</h4>
                  <p className="text-gray-400 text-sm">{testimonial.role}</p>
                </div>
              </div>
              
              {/* Decorative element */}
              <div className="absolute -bottom-16 -right-16 w-32 h-32 bg-gradient-to-br from-purple-600/10 to-transparent rounded-full blur-xl"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};