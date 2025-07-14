import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { LogOut, FileText, User, Shield } from 'lucide-react'
import NotificationDropdown from './NotificationDropdown'

const Navbar = () => {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/signin')
  }

  if (!user) {
    return null
  }

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
              <FileText className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Document Tracker</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              to="/dashboard"
              className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/create-document"
              className="btn-primary text-sm"
            >
              New Document
            </Link>
          </div>

          {/* User Profile */}
          <div className="flex items-center space-x-4">
            {profile && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded-full">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-700">{profile.full_name}</span>
                </div>
                
                {profile.role === 'admin' && (
                  <div className="flex items-center space-x-1 px-2 py-1 bg-primary-100 text-primary-700 rounded-full">
                    <Shield className="h-3 w-3" />
                    <span className="text-xs font-medium">Admin</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Notifications */}
            <NotificationDropdown />
            
            <button
              onClick={handleSignOut}
              className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors p-2 rounded-md"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline text-sm">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3 pt-2 border-t border-gray-200 mt-2">
          <div className="flex flex-col space-y-2">
            <Link
              to="/dashboard"
              className="text-gray-700 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Dashboard
            </Link>
            <Link
              to="/create-document"
              className="btn-primary text-sm inline-flex justify-center"
            >
              New Document
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

export default Navbar