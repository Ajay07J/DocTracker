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
  Briefcase
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

      toast.success('File uploaded successfully')
    } catch (error) {
      console.error('Error uploading file:', error)
      toast.error('Failed to upload file')
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
      toast.error('Failed to create document tracker')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Create New Document Tracker</h1>
        <p className="mt-2 text-gray-600">
          Set up tracking for signatures and approvals on your club document.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Document Information */}
        <div className="card p-6">
          <div className="flex items-center mb-6">
            <FileText className="h-6 w-6 text-primary-600 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900">Document Information</h2>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* Document Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Document Name *
              </label>
              <input
                id="name"
                type="text"
                {...register('name', { 
                  required: 'Document name is required',
                  minLength: { value: 3, message: 'Name must be at least 3 characters' }
                })}
                className={`input-field ${errors.name ? 'border-red-500' : ''}`}
                placeholder="e.g., Event Permission Letter, Budget Approval Request"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                rows={3}
                {...register('description')}
                className="input-field resize-none"
                placeholder="Provide details about the document and its purpose..."
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document File *
              </label>
              
              {!uploadedFile ? (
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-primary-400 transition-colors">
                  <div className="space-y-1 text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500"
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
              ) : (
                <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <FileText className="h-5 w-5 text-green-600 mr-2" />
                    <span className="text-sm text-green-800 font-medium">{uploadedFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}

              {uploading && (
                <div className="mt-2 flex items-center justify-center">
                  <LoadingSpinner size="sm" className="mr-2" />
                  <span className="text-sm text-gray-600">Uploading...</span>
                </div>
              )}
            </div>

            {/* Admin Approval Required */}
            <div className="flex items-start">
              <div className="flex items-center h-5">
                <input
                  id="requires_admin_approval"
                  type="checkbox"
                  {...register('requires_admin_approval')}
                  className="focus:ring-primary-500 h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
              </div>
              <div className="ml-3 text-sm">
                <label htmlFor="requires_admin_approval" className="font-medium text-gray-700 flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Requires Admin Approval
                </label>
                <p className="text-gray-500">
                  Check this if the document needs approval from an admin before proceeding.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Signatories */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-primary-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900">External Signatories</h2>
            </div>
            <button
              type="button"
              onClick={addSignatory}
              className="btn-secondary flex items-center text-sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Signatory
            </button>
          </div>

          <p className="text-gray-600 mb-6">
            Add the people who need to sign or approve this document. List them in the order they should sign.
          </p>

          <div className="space-y-6">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Signatory {index + 1}
                  </h3>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeSignatory(index)}
                      className="text-red-600 hover:text-red-800 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="h-4 w-4 inline mr-1" />
                      Full Name *
                    </label>
                    <input
                      type="text"
                      {...register(`signatories.${index}.name`, {
                        required: 'Name is required'
                      })}
                      className={`input-field ${errors.signatories?.[index]?.name ? 'border-red-500' : ''}`}
                      placeholder="Enter full name"
                    />
                    {errors.signatories?.[index]?.name && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors.signatories[index].name.message}
                      </p>
                    )}
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Briefcase className="h-4 w-4 inline mr-1" />
                      Position/Title
                    </label>
                    <input
                      type="text"
                      {...register(`signatories.${index}.position`)}
                      className="input-field"
                      placeholder="e.g., Dean, Principal, HOD"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Mail className="h-4 w-4 inline mr-1" />
                      Email Address
                    </label>
                    <input
                      type="email"
                      {...register(`signatories.${index}.email`)}
                      className="input-field"
                      placeholder="Enter email address"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="h-4 w-4 inline mr-1" />
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      {...register(`signatories.${index}.phone`)}
                      className="input-field"
                      placeholder="Enter phone number"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="btn-primary flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Creating...
              </>
            ) : (
              <>
                <FileText className="h-5 w-5 mr-2" />
                Create Document Tracker
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default CreateDocument