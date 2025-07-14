import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { 
  ArrowLeft, 
  Upload, 
  Plus, 
  Trash2, 
  FileText, 
  Shield, 
  Users,
  User,
  Mail,
  Phone,
  Briefcase,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'

const CreateDocument = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { register, control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      requires_admin_approval: false,
      signatories: [
        { name: '', position: '', email: '', phone: '', order_index: 0 }
      ]
    }
  })

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'signatories'
  })

  const watchRequiresApproval = watch('requires_admin_approval')

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/png', 'image/jpeg', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, DOC, DOCX, PNG, and JPG files are allowed')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`

      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file)

      if (error) throw error

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName)

      setUploadedFile({
        name: file.name,
        url: publicUrl,
        path: fileName
      })

      toast.success('File uploaded successfully!')
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error(`Failed to upload file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = async () => {
    if (uploadedFile?.path) {
      try {
        await supabase.storage
          .from('documents')
          .remove([uploadedFile.path])
      } catch (error) {
        console.error('Error removing file:', error)
      }
    }
    setUploadedFile(null)
    toast.success('File removed')
  }

  const addSignatory = () => {
    append({ 
      name: '', 
      position: '', 
      email: '', 
      phone: '', 
      order_index: fields.length 
    })
  }

  const removeSignatory = (index) => {
    if (fields.length > 1) {
      remove(index)
      toast.success('Signatory removed')
    } else {
      toast.error('At least one signatory is required')
    }
  }

  const onSubmit = async (data) => {
    if (!uploadedFile) {
      toast.error('Please upload a document file')
      return
    }

    setLoading(true)
    try {
      // Create the document
      const documentData = {
        name: data.name,
        description: data.description,
        file_url: uploadedFile.url,
        file_name: uploadedFile.name,
        created_by: user.id,
        requires_admin_approval: data.requires_admin_approval,
        status: 'pending'
      }

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert([documentData])
        .select()
        .single()

      if (docError) throw docError

      // Create signatories
      if (data.signatories && data.signatories.length > 0) {
        const signatoryData = data.signatories
          .filter(sig => sig.name.trim()) // Only include signatories with names
          .map((sig, index) => ({
            document_id: document.id,
            name: sig.name,
            position: sig.position || null,
            email: sig.email || null,
            phone: sig.phone || null,
            order_index: index,
            is_signed: false
          }))

        if (signatoryData.length > 0) {
          const { error: sigError } = await supabase
            .from('document_signatories')
            .insert(signatoryData)

          if (sigError) throw sigError
        }
      }

      // Log activity
      await supabase
        .from('document_activity')
        .insert([{
          document_id: document.id,
          user_id: user.id,
          action: 'created',
          description: 'Document tracker created'
        }])

      toast.success('Document tracker created successfully!')
      navigate(`/document/${document.id}`)
    } catch (error) {
      console.error('Error creating document:', error)
      toast.error(`Failed to create document tracker: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="group flex items-center text-gray-600 hover:text-gray-900 mb-6 transition-all duration-200 hover:translate-x-1"
          >
            <ArrowLeft className="h-5 w-5 mr-2 transition-transform group-hover:-translate-x-1" />
            Back to Dashboard
          </button>
          
          <div className="text-center sm:text-left">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-3">
              Create Document Tracker
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl">
              Set up tracking for signatures and approvals on your club document.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Document Information Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center text-white">
                <FileText className="h-6 w-6 mr-3" />
                <h2 className="text-xl font-semibold">Document Information</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Document Name */}
              <div className="space-y-2">
                <label htmlFor="name" className="block text-sm font-semibold text-gray-700">
                  Document Name *
                </label>
                <input
                  id="name"
                  type="text"
                  {...register('name', { 
                    required: 'Document name is required',
                    minLength: { value: 3, message: 'Name must be at least 3 characters' }
                  })}
                  className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.name 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                  }`}
                  placeholder="e.g., Event Permission Letter, Budget Approval Request"
                />
                {errors.name && (
                  <div className="flex items-center mt-2 text-red-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    <p className="text-sm">{errors.name.message}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description" className="block text-sm font-semibold text-gray-700">
                  Description
                </label>
                <textarea
                  id="description"
                  rows={4}
                  {...register('description')}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 resize-none"
                  placeholder="Provide details about the document and its purpose..."
                />
              </div>

              {/* File Upload */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Document File *
                </label>
                
                {!uploadedFile ? (
                  <div className="relative">
                    <div className="flex justify-center px-6 pt-8 pb-8 border-3 border-gray-300 border-dashed rounded-xl hover:border-blue-400 transition-all duration-300 bg-gray-50 hover:bg-blue-50 group">
                      <div className="space-y-3 text-center">
                        <div className="flex justify-center">
                          <Upload className="h-12 w-12 text-gray-400 group-hover:text-blue-500 transition-colors duration-300" />
                        </div>
                        <div className="flex text-sm text-gray-600">
                          <label
                            htmlFor="file-upload"
                            className="relative cursor-pointer bg-white rounded-md font-semibold text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 px-3 py-1"
                          >
                            <span>Upload a file</span>
                            <input
                              id="file-upload"
                              name="file-upload"
                              type="file"
                              className="sr-only"
                              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                              onChange={handleFileUpload}
                              disabled={uploading}
                            />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-gray-500">
                          PDF, DOC, DOCX, PNG, JPG up to 10MB
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                      <span className="text-sm text-green-800 font-medium">{uploadedFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="text-red-600 hover:text-red-800 transition-colors p-1 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {uploading && (
                  <div className="flex items-center justify-center py-4">
                    <LoadingSpinner size="sm" className="mr-2" />
                    <span className="text-sm text-gray-600">Uploading file...</span>
                  </div>
                )}
              </div>

              {/* Admin Approval Toggle */}
              <div className="flex items-start space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center h-5">
                  <input
                    id="requires_admin_approval"
                    type="checkbox"
                    {...register('requires_admin_approval')}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                </div>
                <div className="text-sm">
                  <label htmlFor="requires_admin_approval" className="font-semibold text-gray-700 flex items-center">
                    <Shield className="h-4 w-4 mr-2 text-blue-600" />
                    Requires Admin Approval
                  </label>
                  <p className="text-gray-500 mt-1">
                    Check this if the document needs approval from an admin before proceeding.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Signatories Card */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-white">
                  <Users className="h-6 w-6 mr-3" />
                  <h2 className="text-xl font-semibold">External Signatories</h2>
                </div>
                <button
                  type="button"
                  onClick={addSignatory}
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium transition-all duration-200 hover:scale-105"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Signatory
                </button>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-6 text-center sm:text-left">
                Add the people who need to sign or approve this document. List them in the order they should sign.
              </p>

              <div className="space-y-6">
                {fields.map((field, index) => (
                  <div key={field.id} className="border-2 border-gray-100 rounded-xl p-6 hover:border-gray-200 transition-all duration-200 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                        <span className="bg-indigo-100 text-indigo-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mr-3">
                          {index + 1}
                        </span>
                        Signatory {index + 1}
                      </h3>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSignatory(index)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-100 p-2 rounded-lg transition-all duration-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Name */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          <User className="h-4 w-4 inline mr-2" />
                          Full Name *
                        </label>
                        <input
                          type="text"
                          {...register(`signatories.${index}.name`, {
                            required: 'Name is required'
                          })}
                          className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                            errors.signatories?.[index]?.name 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-indigo-500'
                          }`}
                          placeholder="Enter full name"
                        />
                        {errors.signatories?.[index]?.name && (
                          <div className="flex items-center mt-1 text-red-600">
                            <AlertCircle className="h-4 w-4 mr-1" />
                            <p className="text-sm">{errors.signatories[index].name.message}</p>
                          </div>
                        )}
                      </div>

                      {/* Position */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          <Briefcase className="h-4 w-4 inline mr-2" />
                          Position/Title
                        </label>
                        <input
                          type="text"
                          {...register(`signatories.${index}.position`)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                          placeholder="e.g., Dean, Principal, HOD"
                        />
                      </div>

                      {/* Email */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          <Mail className="h-4 w-4 inline mr-2" />
                          Email Address
                        </label>
                        <input
                          type="email"
                          {...register(`signatories.${index}.email`)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                          placeholder="Enter email address"
                        />
                      </div>

                      {/* Phone */}
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-gray-700">
                          <Phone className="h-4 w-4 inline mr-2" />
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          {...register(`signatories.${index}.phone`)}
                          className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 hover:border-gray-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all duration-200"
                          placeholder="Enter phone number"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end space-y-4 sm:space-y-0 sm:space-x-4 pt-6">
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              className="w-full sm:w-auto px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  Creating...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Create Document Tracker
                </div>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateDocument